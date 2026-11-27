/**
 * Endpoints behind the mobile app (/m): the engineer's day, the job timer, scan look-ups
 * and the parts usually fitted to an asset. Every query is scoped to the company.
 */
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  assets, assetAudits, bins, inventory, jobs, jobLabour, jobTimers, locations, maintenanceRequests,
  purchaseOrders, shiftPatterns, absences, stockTransactions, TRIAGE_ROLES,
} from "@shared/schema";
import { availableHours, type AbsenceSpan, type Pattern } from "./kpi/availability";
import { addLabour, JobError } from "./jobs/records";

type Actor = { id: number; name: string; role: string };
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const isLead = (role: string) => (TRIAGE_ROLES as readonly string[]).includes(role);
const sameName = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/** Monday of the week containing `day` (YYYY-MM-DD). */
function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ timer */

export const timerStopSchema = z.object({
  book: z.boolean().default(true),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

function elapsedSeconds(t: { startedAt: Date | null; accumulatedSeconds: number }) {
  const running = t.startedAt ? Math.max(0, Math.floor((Date.now() - t.startedAt.getTime()) / 1000)) : 0;
  return t.accumulatedSeconds + running;
}

/** Hours to book for a timer: nearest quarter hour, at least 0.25 h, at most 24 h. */
export function timerHours(seconds: number): number {
  const q = Math.round(seconds / 900) / 4;
  return Math.min(24, Math.max(0.25, q));
}

export async function getTimer(companyId: number, userId: number) {
  const [t] = await db.select({
    jobId: jobTimers.jobId, startedAt: jobTimers.startedAt, accumulatedSeconds: jobTimers.accumulatedSeconds,
    workDate: jobTimers.workDate, jobTitle: jobs.title, assetId: jobs.assetId,
  }).from(jobTimers)
    .innerJoin(jobs, and(eq(jobs.companyId, jobTimers.companyId), eq(jobs.id, jobTimers.jobId)))
    .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, userId)));
  if (!t) return null;
  const seconds = elapsedSeconds(t);
  return {
    jobId: t.jobId, jobTitle: t.jobTitle, assetId: t.assetId, running: !!t.startedAt,
    startedAt: t.startedAt?.toISOString() ?? null, accumulatedSeconds: t.accumulatedSeconds,
    elapsedSeconds: seconds, workDate: t.workDate, hoursIfStopped: timerHours(seconds),
  };
}

/** Starts (or resumes) the engineer's timer on a job. Opening a job moves it to In Progress. */
export async function startTimer(companyId: number, jobId: string, actor: Actor) {
  await db.transaction(async (tx) => {
    const [job] = await tx.select({ id: jobs.id, status: jobs.status }).from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId)));
    if (!job) throw new JobError("Job not found", 404);
    if (job.status === "Completed") throw new JobError("This job is completed. Reopen it before timing work on it.");
    const [cur] = await tx.select().from(jobTimers)
      .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id))).for("update");
    if (cur && cur.jobId !== jobId) {
      throw new JobError(`Your timer is on ${cur.jobId}. Stop it there first, so its time is booked.`, 409);
    }
    if (cur) {
      if (!cur.startedAt) {
        await tx.update(jobTimers).set({ startedAt: new Date() })
          .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id)));
      }
    } else {
      await tx.insert(jobTimers).values({ companyId, userId: actor.id, jobId, startedAt: new Date(), accumulatedSeconds: 0, workDate: ukToday() });
    }
    if (job.status === "Open" || job.status === "Scheduled") {
      await tx.update(jobs).set({ status: "In Progress" }).where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId)));
    }
  });
  return getTimer(companyId, actor.id);
}

export async function pauseTimer(companyId: number, actor: Actor) {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(jobTimers)
      .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id))).for("update");
    if (!cur) throw new JobError("No timer is running.", 404);
    if (!cur.startedAt) return;
    await tx.update(jobTimers).set({ startedAt: null, accumulatedSeconds: elapsedSeconds(cur) })
      .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id)));
  });
  return getTimer(companyId, actor.id);
}

/** Stops the timer and, unless discarded, books the time (to the day the timer started). */
export async function stopTimer(companyId: number, actor: Actor, input: z.infer<typeof timerStopSchema>) {
  const [cur] = await db.select().from(jobTimers)
    .where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id)));
  if (!cur) throw new JobError("No timer is running.", 404);
  let booked: { hours: number; jobId: string } | null = null;
  if (input.book) {
    const hours = timerHours(elapsedSeconds(cur));
    await addLabour(companyId, cur.jobId, { workDate: cur.workDate, hours, note: input.note ?? "Timed in the mobile app" }, actor);
    booked = { hours, jobId: cur.jobId };
  }
  await db.delete(jobTimers).where(and(eq(jobTimers.companyId, companyId), eq(jobTimers.userId, actor.id)));
  return { booked };
}

/* ------------------------------------------------------------- my day */

export async function myDay(companyId: number, actor: Actor) {
  const today = ukToday();
  const monday = weekStart(today);
  const [myJobs, myLabour, pats, offs, audits, newRequests, timer] = await Promise.all([
    db.select({
      id: jobs.id, title: jobs.title, status: jobs.status, priority: jobs.priority, type: jobs.type,
      dueDate: jobs.dueDate, assetId: jobs.assetId, assetName: assets.name, locationName: locations.name,
    }).from(jobs)
      .leftJoin(assets, and(eq(assets.companyId, jobs.companyId), eq(assets.id, jobs.assetId)))
      .leftJoin(locations, and(eq(locations.companyId, assets.companyId), eq(locations.id, assets.locationId)))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.assigneeId, actor.id), ne(jobs.status, "Completed"))),
    db.select({ hours: jobLabour.hours, workDate: jobLabour.workDate, type: jobs.type }).from(jobLabour)
      .innerJoin(jobs, and(eq(jobs.companyId, jobLabour.companyId), eq(jobs.id, jobLabour.jobId)))
      .where(and(eq(jobLabour.companyId, companyId), eq(jobLabour.userId, actor.id), sql`${jobLabour.workDate} >= ${monday}`)),
    db.select().from(shiftPatterns).where(and(eq(shiftPatterns.companyId, companyId), eq(shiftPatterns.userId, actor.id))),
    db.select().from(absences).where(and(eq(absences.companyId, companyId), eq(absences.userId, actor.id))),
    db.select().from(assetAudits).where(and(eq(assetAudits.companyId, companyId), inArray(assetAudits.status, ["Pending", "Scheduled"]))),
    isLead(actor.role)
      ? db.select({ n: sql<number>`count(*)::int` }).from(maintenanceRequests)
        .where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.status, "Submitted")))
      : Promise.resolve([{ n: 0 }]),
    getTimer(companyId, actor.id),
  ]);

  const patterns: Pattern[] = pats.map((x) => ({ effectiveFrom: x.effectiveFrom, mon: +x.mon, tue: +x.tue, wed: +x.wed, thu: +x.thu, fri: +x.fri, sat: +x.sat, sun: +x.sun }));
  const spans: AbsenceSpan[] = offs.map((a) => ({ startDate: a.startDate, endDate: a.endDate, hoursPerDay: a.hoursPerDay === null ? null : +a.hoursPerDay }));
  const sum = (rows: typeof myLabour) => Math.round(rows.reduce((s, l) => s + +l.hours, 0) * 100) / 100;
  const todays = myLabour.filter((l) => l.workDate === today);

  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>;
  const jobsOut = myJobs.map((j) => ({ ...j, overdue: !!j.dueDate && j.dueDate.slice(0, 10) < today, dueToday: !!j.dueDate && j.dueDate.slice(0, 10) === today }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));

  // My audits, one entry per area and date.
  const groups = new Map<string, { key: string; date: string | null; location: string | null; auditIds: string[]; assetIds: string[]; overdue: boolean }>();
  for (const a of audits.filter((x) => sameName(x.assignedTo, actor.name))) {
    const date = a.scheduledDate ? a.scheduledDate.slice(0, 10) : null;
    const key = `${date ?? ""}|${a.expectedLocation ?? ""}`;
    const g = groups.get(key) ?? { key, date, location: a.expectedLocation, auditIds: [], assetIds: [], overdue: !!date && date < today };
    g.auditIds.push(a.id); g.assetIds.push(a.assetId);
    groups.set(key, g);
  }

  return {
    today, name: actor.name, role: actor.role, timer,
    jobs: jobsOut,
    audits: Array.from(groups.values()).sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9")),
    hours: {
      today: { booked: sum(todays), planned: sum(todays.filter((l) => l.type === "Planned")), available: availableHours(today, today, patterns, spans) },
      week: { booked: sum(myLabour), available: availableHours(monday, today, patterns, spans), from: monday },
      hasShifts: patterns.length > 0,
    },
    newRequests: newRequests[0]?.n ?? 0,
  };
}

/* -------------------------------------------------------------- scan / look-up */

/** What a scanned or typed code is: an asset, part, bin, job or PO. Exact matches first, then names. */
export async function lookupCode(companyId: number, raw: string, actor: Actor) {
  // QR codes may hold a link to the app (…/m/asset/9102106) or a "TYPE:ID" label; keep the ID.
  let code = raw.trim();
  const fromUrl = code.match(/\/m\/(?:asset|part|job|bin)\/([^/?#]+)/i);
  if (fromUrl) code = decodeURIComponent(fromUrl[1]);
  code = code.replace(/^(asset|part|bin|job|po)\s*[:#]\s*/i, "").trim();
  if (!code) return { code, assets: [], parts: [], bins: [], jobs: [], purchaseOrders: [], exact: false };
  const lc = code.toLowerCase();
  const eqi = (col: any) => sql`lower(${col}) = ${lc}`;

  const [a, p, b, j, po] = await Promise.all([
    db.select().from(assets).where(and(eq(assets.companyId, companyId), or(eqi(assets.id), eqi(assets.serialNumber)))),
    db.select().from(inventory).where(and(eq(inventory.companyId, companyId), or(eqi(inventory.id), eqi(inventory.manufacturerPartNo)))),
    db.select().from(bins).where(and(eq(bins.companyId, companyId), eqi(bins.id))),
    db.select({ id: jobs.id, title: jobs.title, status: jobs.status }).from(jobs).where(and(eq(jobs.companyId, companyId), eqi(jobs.id))),
    db.select({ id: purchaseOrders.id, vendor: purchaseOrders.vendor, status: purchaseOrders.status }).from(purchaseOrders)
      .where(and(eq(purchaseOrders.companyId, companyId), eqi(purchaseOrders.id))),
  ]);
  let assetRows = a, partRows = p, exact = true;
  if (!a.length && !p.length && !b.length && !j.length && !po.length) {
    exact = false;
    const like = `%${lc.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    [assetRows, partRows] = await Promise.all([
      db.select().from(assets).where(and(eq(assets.companyId, companyId), or(sql`lower(${assets.name}) like ${like}`, sql`lower(${assets.id}) like ${like}`))).limit(8),
      db.select().from(inventory).where(and(eq(inventory.companyId, companyId), or(sql`lower(${inventory.name}) like ${like}`, sql`lower(${inventory.id}) like ${like}`))).limit(8),
    ]);
  }
  return {
    code, exact,
    assets: await Promise.all(assetRows.map((x) => assetSummary(companyId, x, actor))),
    parts: partRows.map(partSummary),
    bins: await Promise.all(b.map(async (bin) => ({
      id: bin.id, description: bin.description,
      parts: (await db.select().from(inventory).where(and(eq(inventory.companyId, companyId), eq(inventory.binId, bin.id)))).map(partSummary),
    }))),
    jobs: j, purchaseOrders: po,
  };
}

function partSummary(p: typeof inventory.$inferSelect) {
  return { id: p.id, name: p.name, stock: p.stock, minStock: p.minStock, unit: p.unit, binId: p.binId, unitCost: p.unitCost, manufacturerPartNo: p.manufacturerPartNo };
}

async function assetSummary(companyId: number, a: typeof assets.$inferSelect, actor: Actor) {
  const [loc] = a.locationId
    ? await db.select({ name: locations.name }).from(locations).where(and(eq(locations.companyId, companyId), eq(locations.id, a.locationId)))
    : [];
  const openJobs = await db.select({ id: jobs.id, title: jobs.title, status: jobs.status, priority: jobs.priority, assigneeId: jobs.assigneeId })
    .from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.assetId, a.id), ne(jobs.status, "Completed")))
    .orderBy(desc(jobs.createdAt)).limit(10);
  // An open audit of this asset that the person scanning can carry out.
  const audits = await db.select().from(assetAudits)
    .where(and(eq(assetAudits.companyId, companyId), eq(assetAudits.assetId, a.id), inArray(assetAudits.status, ["Pending", "Scheduled"])));
  const audit = audits.find((x) => sameName(x.assignedTo, actor.name)) ?? (isLead(actor.role) ? audits[0] : undefined);
  return {
    id: a.id, name: a.name, status: a.status, criticality: a.criticality, category: a.category,
    manufacturer: a.manufacturer, model: a.model, serialNumber: a.serialNumber,
    locationId: a.locationId, locationName: loc?.name ?? null,
    openJobs, audit: audit ? { id: audit.id, expectedLocation: audit.expectedLocation, scheduledDate: audit.scheduledDate } : null,
  };
}

/** Parts most often issued to jobs on this asset, with today's stock. */
export async function commonPartsForAsset(companyId: number, assetId: string) {
  const rows = await db.select({
    partId: stockTransactions.partId,
    times: sql<number>`count(*)::int`,
    qty: sql<number>`coalesce(sum(-${stockTransactions.quantity}), 0)::int`,
  }).from(stockTransactions)
    .where(and(eq(stockTransactions.companyId, companyId), eq(stockTransactions.type, "Job Issue"), eq(stockTransactions.assetId, assetId)))
    .groupBy(stockTransactions.partId)
    .orderBy(sql`count(*) desc`)
    .limit(6);
  if (!rows.length) return [];
  const parts = await db.select().from(inventory).where(and(eq(inventory.companyId, companyId), inArray(inventory.id, rows.map((r) => r.partId))));
  return rows.flatMap((r) => {
    const p = parts.find((x) => x.id === r.partId);
    return p ? [{ ...partSummary(p), timesUsed: r.times, quantityUsed: r.qty }] : [];
  });
}
