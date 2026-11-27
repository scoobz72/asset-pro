/**
 * Notifications: writes the in-app list (the bell) and sends phone/browser pushes, each per the
 * person's settings. Sending never blocks or fails the request that caused it.
 */
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  appSettings, companies, inventory, notificationRuns, notifications, pushSubscriptions, users,
} from "@shared/schema";
import { NOTIFY_KINDS, STOCK_DIGEST_HOUR, type NotifyKind } from "@shared/constants";
import { generateVapidKeys, sendPush, type VapidKeys } from "./webpush";

type Prefs = Record<string, { app?: boolean; push?: boolean }>;
type Recipient = { id: number; name: string; role: string; notifyPrefs: Prefs };
export type NotifyMessage = { kind: NotifyKind; title: string; body?: string | null; link?: string | null };

const MOBILE_UA = /Mobi|Android|iPhone|iPad/i;

/* -------------------------------------------------------------------- settings */

/** Whether a kind is available to a role, and its effective app/push setting for this person. */
export function resolvePrefs(role: string, prefs: Prefs) {
  return (Object.keys(NOTIFY_KINDS) as NotifyKind[]).flatMap((kind) => {
    const k = NOTIFY_KINDS[kind];
    if (k.roles && !(k.roles as readonly string[]).includes(role)) return [];
    const on = k.defaultOn ? (k.defaultOn as readonly string[]).includes(role) : true;
    const p = prefs?.[kind] ?? {};
    return [{ kind, label: k.label, help: k.help, app: p.app ?? on, push: p.push ?? on }];
  });
}

/** The server's Web Push key pair: from the environment, else generated once and kept in the database. */
let vapidCache: VapidKeys | null = null;
export async function getVapid(): Promise<VapidKeys> {
  if (vapidCache) return vapidCache;
  const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.MAIL_FROM || "notifications@mycmms.co.uk"}`;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_JWK) {
    vapidCache = { publicKey: process.env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(process.env.VAPID_PRIVATE_JWK), subject };
    return vapidCache;
  }
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid"));
  if (row) {
    vapidCache = { ...JSON.parse(row.value), subject };
    return vapidCache!;
  }
  const keys = generateVapidKeys(subject);
  await db.insert(appSettings).values({ key: "vapid", value: JSON.stringify({ publicKey: keys.publicKey, privateJwk: keys.privateJwk }) })
    .onConflictDoNothing();
  // Another process may have won the race: always use what's stored.
  const [stored] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid"));
  vapidCache = { ...JSON.parse(stored.value), subject };
  return vapidCache!;
}

/* -------------------------------------------------------------------- sending */

async function recipients(companyId: number, where: { ids?: number[]; roles?: readonly string[] }): Promise<Recipient[]> {
  const conds = [eq(users.companyId, companyId)];
  if (where.ids) { if (!where.ids.length) return []; conds.push(inArray(users.id, where.ids)); }
  if (where.roles) conds.push(inArray(users.role, [...where.roles]));
  return db.select({ id: users.id, name: users.name, role: users.role, notifyPrefs: users.notifyPrefs }).from(users).where(and(...conds));
}

/** Notifies people (never the person who caused it). Safe to call without awaiting. */
export async function notify(companyId: number, to: { ids?: number[]; roles?: readonly string[] }, msg: NotifyMessage, exceptUserId?: number | null) {
  try {
    const people = (await recipients(companyId, to)).filter((u) => u.id !== exceptUserId);
    const appTo: number[] = [], pushTo: number[] = [];
    for (const u of people) {
      const p = resolvePrefs(u.role, u.notifyPrefs ?? {}).find((x) => x.kind === msg.kind);
      if (!p) continue;
      if (p.app) appTo.push(u.id);
      if (p.push) pushTo.push(u.id);
    }
    if (appTo.length) {
      await db.insert(notifications).values(appTo.map((userId) => ({
        companyId, userId, kind: msg.kind, title: msg.title.slice(0, 200), body: msg.body?.slice(0, 1000) ?? null, link: msg.link ?? null,
      })));
    }
    if (pushTo.length) await pushToUsers(companyId, pushTo, msg);
  } catch (err) {
    console.error(`[notify] ${msg.kind} failed:`, (err as Error).message);
  }
}

/** Desktop links → the matching mobile screen, for pushes to phones and taps in the mobile app. */
export function mobileLink(link: string | null | undefined): string {
  if (!link) return "/m";
  const job = link.match(/^\/jobs\/([^/?#]+)/);
  if (job) return `/m/job/${job[1]}`;
  if (link.startsWith("/request-portal")) return "/m/requests";
  if (link.startsWith("/inventory")) return "/m/stock?low=1";
  return link.startsWith("/m") ? link : "/m";
}

async function pushToUsers(companyId: number, userIds: number[], msg: NotifyMessage) {
  const subs = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.companyId, companyId), inArray(pushSubscriptions.userId, userIds)));
  if (!subs.length) return;
  const keys = await getVapid();
  await Promise.all(subs.map(async (s) => {
    const link = s.userAgent && MOBILE_UA.test(s.userAgent) ? mobileLink(msg.link) : (msg.link ?? "/");
    const result = await sendPush(s, { title: msg.title, body: msg.body ?? "", link, tag: msg.kind === "stock_daily" ? msg.kind : undefined }, keys);
    if (result === "gone") await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
    else if (result === "ok") await db.update(pushSubscriptions).set({ lastOkAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
  }));
}

export async function sendTestPush(companyId: number, userId: number) {
  const subs = await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.companyId, companyId), eq(pushSubscriptions.userId, userId)));
  if (!subs.length) return { devices: 0, delivered: 0 };
  const keys = await getVapid();
  let delivered = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: "myCMMS notifications are on", body: "This is a test. You'll get alerts like this on this device.", link: s.userAgent && MOBILE_UA.test(s.userAgent) ? "/m" : "/", tag: "test" }, keys);
    if (r === "ok") delivered++;
    if (r === "gone") await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
  }
  return { devices: subs.length, delivered };
}

/* -------------------------------------------------------------------- events */

const LEAD_ROLES = NOTIFY_KINDS.request_new.roles;

async function userIdByName(companyId: number, name: string | null | undefined) {
  if (!name?.trim()) return null;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.companyId, companyId), sql`lower(trim(${users.name})) = ${name.trim().toLowerCase()}`));
  return u?.id ?? null;
}

type JobLike = { id: string; title: string; priority?: string | null; type?: string | null; assetId?: string | null; assigneeId?: number | null };
const jobLine = (j: JobLike) => [j.type, j.priority, j.assetId].filter(Boolean).join(" · ");

export function onRequestSubmitted(companyId: number, r: { id: string; title: string; urgency: string; assetId?: string | null; area?: string | null; requestedBy: string }, actorId?: number | null) {
  void notify(companyId, { roles: LEAD_ROLES }, {
    kind: "request_new",
    title: `${r.urgency === "High" ? "Urgent request" : "New request"}: ${r.title}`,
    body: [r.id, r.assetId ?? r.area, `from ${r.requestedBy}`, r.urgency !== "High" ? `${r.urgency} urgency` : null].filter(Boolean).join(" · "),
    link: "/request-portal",
  }, actorId);
}

export function onJobAssigned(companyId: number, job: JobLike, actorId?: number | null) {
  if (!job.assigneeId) return;
  void notify(companyId, { ids: [job.assigneeId] }, {
    kind: "job_assigned", title: `Assigned to you: ${job.title}`, body: [job.id, jobLine(job)].filter(Boolean).join(" · "), link: `/jobs/${encodeURIComponent(job.id)}`,
  }, actorId);
}

/** A new job: tell the assignee, or the leads if nobody has it. */
export function onJobCreated(companyId: number, job: JobLike & { status?: string | null }, actorId?: number | null) {
  if (job.status === "Completed") return;
  if (job.assigneeId) return onJobAssigned(companyId, job, actorId);
  void notify(companyId, { roles: LEAD_ROLES }, {
    kind: "job_unassigned", title: `New job needs assigning: ${job.title}`, body: [job.id, jobLine(job)].filter(Boolean).join(" · "), link: `/jobs/${encodeURIComponent(job.id)}`,
  }, actorId);
}

export async function onRequestConverted(companyId: number, r: { id: string; title: string; requestedBy: string }, job: JobLike, actorId?: number | null) {
  const requester = await userIdByName(companyId, r.requestedBy);
  if (requester) {
    void notify(companyId, { ids: [requester] }, {
      kind: "request_update", title: `Your request is now job ${job.id}`, body: r.title, link: `/jobs/${encodeURIComponent(job.id)}`,
    }, actorId);
  }
  onJobAssigned(companyId, job, actorId);
}

export async function onRequestRejected(companyId: number, r: { id: string; title: string; requestedBy: string; rejectionReason?: string | null }, actorId?: number | null) {
  const requester = await userIdByName(companyId, r.requestedBy);
  if (!requester) return;
  void notify(companyId, { ids: [requester] }, {
    kind: "request_update", title: `Request not actioned: ${r.title}`, body: [r.id, r.rejectionReason].filter(Boolean).join(" · "), link: "/request-portal",
  }, actorId);
}

/* -------------------------------------------------------------------- daily stock summary */

export async function stockSummary(companyId: number) {
  const rows = await db.select({ id: inventory.id, name: inventory.name, stock: inventory.stock, minStock: inventory.minStock, unit: inventory.unit })
    .from(inventory).where(and(eq(inventory.companyId, companyId), sql`(${inventory.stock} <= 0 OR (${inventory.minStock} > 0 AND ${inventory.stock} <= ${inventory.minStock}))`));
  const out = rows.filter((r) => r.stock <= 0).sort((a, b) => a.name.localeCompare(b.name));
  const low = rows.filter((r) => r.stock > 0).sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));
  return { out, low };
}

export async function sendStockSummary(companyId: number) {
  const { out, low } = await stockSummary(companyId);
  if (!out.length && !low.length) return { out: 0, low: 0, sent: false };
  const names = [...out.map((p) => `${p.name} (none)`), ...low.map((p) => `${p.name} (${p.stock}/${p.minStock})`)];
  const head = [out.length ? `${out.length} out of stock` : null, low.length ? `${low.length} low` : null].filter(Boolean).join(", ");
  await notify(companyId, {}, {
    kind: "stock_daily",
    title: `Stock: ${head}`,
    body: names.slice(0, 6).join(", ") + (names.length > 6 ? ` and ${names.length - 6} more` : ""),
    link: "/inventory",
  });
  return { out: out.length, low: low.length, sent: true };
}

const ukParts = () => {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now));
  return { date, hour };
};

/** Once per company per day, from 07:00 UK time; the run table makes it safe across restarts. */
async function dailyTick() {
  const { date, hour } = ukParts();
  if (hour < STOCK_DIGEST_HOUR) return;
  const all = await db.select({ id: companies.id }).from(companies);
  for (const c of all) {
    const claimed = await db.insert(notificationRuns).values({ companyId: c.id, kind: "stock_daily", runDate: date })
      .onConflictDoNothing().returning();
    if (!claimed.length) continue;
    const r = await sendStockSummary(c.id).catch((err) => { console.error("[notify] stock summary failed:", err.message); return null; });
    if (r?.sent) console.log(`[notify] stock summary for company ${c.id}: ${r.out} out, ${r.low} low`);
  }
  // Keep the bell tidy: read notifications older than 90 days go.
  await db.delete(notifications).where(and(lt(notifications.createdAt, sql`now() - interval '90 days'`), sql`${notifications.readAt} is not null`));
}

let started = false;
export function startNotificationScheduler() {
  if (started || process.env.NOTIFY_SCHEDULER === "off") return;
  started = true;
  const run = () => dailyTick().catch((err) => console.error("[notify] scheduler:", err.message));
  setTimeout(run, 30_000);
  setInterval(run, 5 * 60_000).unref();
}

/* -------------------------------------------------------------------- reading */

export async function listNotifications(companyId: number, userId: number, limit = 40) {
  const [items, [{ unread }]] = await Promise.all([
    db.select().from(notifications).where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt)).limit(limit),
    db.select({ unread: sql<number>`count(*)::int` }).from(notifications)
      .where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { unread, items: items.map((n) => ({ ...n, mobileLink: mobileLink(n.link) })) };
}

export async function unreadCount(companyId: number, userId: number) {
  const [{ unread }] = await db.select({ unread: sql<number>`count(*)::int` }).from(notifications)
    .where(and(eq(notifications.companyId, companyId), eq(notifications.userId, userId), isNull(notifications.readAt)));
  return unread;
}

export async function markRead(companyId: number, userId: number, id?: number) {
  const conds = [eq(notifications.companyId, companyId), eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (id) conds.push(eq(notifications.id, id));
  await db.update(notifications).set({ readAt: new Date() }).where(and(...conds));
}

