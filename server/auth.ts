import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./password";
import { users, companies, loginSchema, accessRequestInputSchema, PRIVILEGED_ROLES, ADMIN_ROLES, PLATFORM_ADMIN_ROLE, type PublicUser } from "@shared/schema";

declare global {
  namespace Express {
    // The authenticated user attached by passport (never contains the password hash).
    interface User extends PublicUser {}
  }
}

const SESSION_TABLE = "user_sessions";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

// Used so that logins for unknown emails take as long as logins with a wrong password.
let dummyHashPromise: Promise<string> | undefined;
function dummyHash() {
  dummyHashPromise ??= hashPassword("timing-equalisation-only");
  return dummyHashPromise;
}

async function ensureSessionTable() {
  // Created here instead of via connect-pg-simple's createTableIfMissing, which reads
  // a .sql file from disk and does not work once the server is bundled.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${SESSION_TABLE}" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_${SESSION_TABLE}_expire" ON "${SESSION_TABLE}" ("expire");
  `);
}

/**
 * Credential hygiene performed at startup:
 * - Any password that is not a recognised hash was stored in plaintext by an earlier
 *   version of the app (and exposed through the API), so it is cleared.
 * - If ADMIN_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are set and there is no platform admin
 *   yet, the platform's own company and its admin account are created. If the platform
 *   admin exists but has no password, the bootstrap password is assigned to it.
 */
async function prepareCredentials() {
  const cleared = await db
    .update(users)
    .set({ password: null })
    .where(sql`${users.password} IS NOT NULL AND ${users.password} NOT LIKE 'scrypt$%'`)
    .returning({ id: users.id });
  if (cleared.length > 0) {
    console.warn(`[auth] Cleared ${cleared.length} legacy plaintext password(s); those users must be given a new password.`);
  }

  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!bootstrapPassword || !adminEmail) return;
  if (bootstrapPassword.length < 8) {
    console.warn("[auth] ADMIN_BOOTSTRAP_PASSWORD is shorter than 8 characters and was ignored.");
    return;
  }

  const [platformAdmin] = await db
    .select({ id: users.id, email: users.email, password: users.password })
    .from(users)
    .where(eq(users.role, PLATFORM_ADMIN_ROLE))
    .orderBy(users.id)
    .limit(1);

  if (platformAdmin) {
    // Recovery only: give the existing platform admin a password if it has none.
    if (!platformAdmin.password) {
      await db.update(users).set({ password: await hashPassword(bootstrapPassword) }).where(eq(users.id, platformAdmin.id));
      console.log(`[auth] Bootstrap password assigned to platform admin ${platformAdmin.email ?? `#${platformAdmin.id}`}.`);
    }
    return;
  }

  // First start: create the platform's own company and its admin account.
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, adminEmail)).limit(1);
  if (existing) {
    console.warn(`[auth] ${adminEmail} already belongs to a company, so it was not made platform admin.`);
    return;
  }
  const passwordHash = await hashPassword(bootstrapPassword);
  await db.transaction(async (tx) => {
    const [hq] = await tx.insert(companies).values({ name: process.env.PLATFORM_COMPANY_NAME?.trim() || "MyCMMS HQ" }).returning();
    await tx.insert(users).values({
      companyId: hq.id,
      name: process.env.ADMIN_NAME?.trim() || "Platform Admin",
      email: adminEmail,
      role: PLATFORM_ADMIN_ROLE,
      status: "Available",
      password: passwordHash,
    });
  });
  console.log(`[auth] Created platform admin ${adminEmail}.`);
}

/** Simple fixed-window limiter for the public access-request form. */
const accessRequestHits = new Map<string, { count: number; resetAt: number }>();
function allowAccessRequest(ip: string): boolean {
  const now = Date.now();
  const entry = accessRequestHits.get(ip);
  if (!entry || entry.resetAt < now) {
    accessRequestHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    if (accessRequestHits.size > 10_000) accessRequestHits.clear();
    return true;
  }
  entry.count += 1;
  return entry.count <= 5;
}

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }

  await ensureSessionTable();
  await prepareCredentials();

  const PgStore = connectPgSimple(session);
  app.set("trust proxy", 1);
  app.use(
    session({
      name: "promaintain.sid",
      store: new PgStore({ pool, tableName: SESSION_TABLE, createTableIfMissing: false }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: "auto",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  passport.use(
    new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
      try {
        const record = await storage.getUserCredentialsByEmail(email);
        if (!record?.password) {
          await verifyPassword(password, await dummyHash());
          return done(null, false);
        }
        if (!(await verifyPassword(password, record.password))) {
          return done(null, false);
        }
        const company = await storage.getCompany(record.companyId);
        if (!company || company.status !== "Active") {
          return done(null, false, { message: "suspended" });
        }
        const { password: _omit, ...publicUser } = record;
        return done(null, publicUser);
      } catch (err) {
        return done(err);
      }
    }),
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Reload on every request so role changes and removals take effect immediately.
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      // A suspended company's users are signed out on their next request.
      const company = await storage.getCompany(user.companyId);
      done(null, company?.status === "Active" ? user : false);
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  app.post("/api/auth/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    req.body = parsed.data;
    passport.authenticate("local", (err: unknown, user: Express.User | false, info?: unknown) => {
      if (err) return next(err);
      if (!user && (info as { message?: string } | undefined)?.message === "suspended") {
        return res.status(403).json({ message: "This company's account is suspended. Please contact support." });
      }
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        try {
          res.json(await sessionUser(user));
        } catch (e) {
          next(e);
        }
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("promaintain.sid");
        res.status(204).end();
      });
    });
  });

  app.get("/api/auth/me", async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      res.json(await sessionUser(req.user));
    } catch (e) {
      next(e);
    }
  });

  // Public "Request access" form on the landing page.
  app.post("/api/access-requests", async (req, res, next) => {
    try {
      if (!allowAccessRequest(req.ip ?? "unknown")) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      const parsed = accessRequestInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: "Please check the form and try again." });
      }
      const { website: _honeypot, ...data } = parsed.data;
      await storage.createAccessRequest(data);
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  // Every other /api route requires a signed-in user.
  app.use("/api", requireAuth);
}

async function sessionUser(user: Express.User) {
  const company = await storage.getCompany(user.companyId);
  return { ...user, companyName: company?.name ?? "" };
}

/** The signed-in user's company. Only call on routes behind requireAuth. */
export function companyOf(req: Request): number {
  if (!req.user) throw Object.assign(new Error("Not authenticated"), { status: 401 });
  return req.user.companyId;
}

export function isPlatformAdmin(user: Express.User | undefined): boolean {
  return user?.role === PLATFORM_ADMIN_ROLE;
}

/** Restricts a route to the platform admin. */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isPlatformAdmin(req.user)) {
    return res.status(403).json({ message: "You do not have permission to perform this action" });
  }
  next();
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) return next();
  res.status(401).json({ message: "Authentication required" });
};

export function isPrivileged(user: Express.User | undefined): boolean {
  return !!user && (PRIVILEGED_ROLES as readonly string[]).includes(user.role);
}

export function isAdmin(user: Express.User | undefined): boolean {
  return !!user && (ADMIN_ROLES as readonly string[]).includes(user.role);
}

/** Restricts a route to Admins (people management: users, roles, approval limits). */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: "Only an Admin can manage users, roles and approval limits" });
  }
  next();
}

/** Restricts a route to Manager/Admin users. */
export function requirePrivileged(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ message: "You do not have permission to perform this action" });
  }
  next();
}
