import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./password";
import { users, loginSchema, PRIVILEGED_ROLES, type PublicUser } from "@shared/schema";

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
 * - If ADMIN_BOOTSTRAP_PASSWORD is set and the bootstrap admin has no password yet,
 *   it is hashed and assigned so the first administrator can sign in.
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
  if (!bootstrapPassword) return;
  if (bootstrapPassword.length < 8) {
    console.warn("[auth] ADMIN_BOOTSTRAP_PASSWORD is shorter than 8 characters and was ignored.");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      adminEmail
        ? and(eq(sql`lower(${users.email})`, adminEmail), isNull(users.password))
        : and(inArray(users.role, [...PRIVILEGED_ROLES]), isNull(users.password)),
    )
    .orderBy(users.id)
    .limit(1);
  if (!target) return;

  // Only bootstrap when no privileged account can sign in yet.
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.password} IS NOT NULL AND ${inArray(users.role, [...PRIVILEGED_ROLES])}`)
    .limit(1);
  if (existingAdmin) return;

  await db.update(users).set({ password: await hashPassword(bootstrapPassword) }).where(eq(users.id, target.id));
  console.log(`[auth] Bootstrap password assigned to administrator account ${target.email ?? `#${target.id}`}.`);
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
      done(null, user ?? false);
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
    passport.authenticate("local", (err: unknown, user: Express.User | false) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json(user);
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

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  // Every other /api route requires a signed-in user.
  app.use("/api", requireAuth);
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) return next();
  res.status(401).json({ message: "Authentication required" });
};

export function isPrivileged(user: Express.User | undefined): boolean {
  return !!user && (PRIVILEGED_ROLES as readonly string[]).includes(user.role);
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
