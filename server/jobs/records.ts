/**
 * Job records (docs/asset-stock-jobs-plan.md 1.2): labour hours per engineer, notes and
 * follow-ups, parts used and linked POs, plus the asset's KPI trend for the job page.
 * Anyone signed in books their own hours on any job (breakdown, request, planned/PPM).
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  jobs, jobLabour, jobNotes, users, assets, stockTransactions, purchaseOrders, TRIAGE_ROLES, PRIVILEGED_ROLES,
} from "@shared/schema";
import type { z } from "zod";
import type { labourEntrySchema, jobNoteSchema, followUpJobSchema } from "@shared/schema";
import { nextNumber } from "../numbering";
import { onJobCreated } from "../notify";

export class JobError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface JobActor { id: number; name: string; role: string }
const isLead = (role: string) => (TRIAGE_ROLES as readonly string[]).includes(role);
const isManager = (role: string) => (PRIVILEGED_ROLES as readonly string[]).includes(role);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function getJobOr404(q: typeof db | any, companyId: number, id: string) {
  const [job] = await q.select().from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, id)));
  if (!job) throw new JobError(`Job ${id} not found`, 404);
  return job;
}

export async function getJobDetail(companyId: number, id: string, viewer: JobActor) {
  const job = await getJobOr404(db, companyId, id);
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.companyId, companyId));
  const nameOf = (uid: number | null) => (uid === null ? null : people.find((p) => p.id === uid)?.name ?? null);
  const [asset] = job.assetId
    ? await db.select().from(assets).where(and(eq(assets.companyId, companyId), eq(assets.id, job.assetId)))
    : [undefined];

  const labourRows = await db.select().from(jobLabour)
    .where(and(eq(jobLabour.companyId, companyId), eq(jobLabour.jobId, id)))
    .orderBy(asc(jobLabour.workDate), asc(jobLabour.id));
  // Costs (rates) are pay information: shown to Managers/Admins only.
  const showCost = isManager(viewer.role);
  const labour = labourRows.map((l) => ({
    id: l.id, userId: l.userId, userName: nameOf(l.userId), workDate: l.workDate, hours: Number(l.hours),
    note: l.note, createdBy: l.createdBy, createdAt: l.createdAt,
    cost: showCost && l.rate !== null ? round2(Number(l.hours) * Number(l.rate)) : null,
    canDelete: l.userId === viewer.id || isManager(viewer.role),
  }));

  const notes = await db.select().from(jobNotes)
    .where(and(eq(jobNotes.companyId, companyId), eq(jobNotes.jobId, id)))
    .orderBy(asc(jobNotes.createdAt), asc(jobNotes.id));

  const parts = await db.select().from(stockTransactions)
    .where(and(eq(stockTransactions.companyId, companyId), eq(stockTransactions.jobId, id),
      inArray(stockTransactions.type, ["Job Issue", "Return to Stores", "Purchase Order"])))
    .orderBy(asc(stockTransactions.createdAt));

  const pos = await db.select({
    id: purchaseOrders.id, vendor: purchaseOrders.vendor, status: purchaseOrders.status,
    currency: purchaseOrders.currency, total: purchaseOrders.total, totalHome: purchaseOrders.totalHome,
  }).from(purchaseOrders).where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.jobId, id)));

  const hours = round2(labour.reduce((s, l) => s + l.hours, 0));
  const labourCost = showCost ? round2(labour.reduce((s, l) => s + (l.cost ?? 0), 0)) : null;
  const partsCost = round2(parts.filter((p) => p.type !== "Purchase Order").reduce((s, p) => s - Number(p.value ?? 0), 0));

  return {
    ...job,
    assetName: asset?.name ?? null,
    assigneeName: nameOf(job.assigneeId),
    labour, notes, parts, purchaseOrders: pos,
    totals: { hours, labourCost, partsCost },
    assetKpis: job.assetId ? await assetKpis(companyId, job.assetId) : null,
  };
}

/** Breakdowns per month (last 12), MTTR and MTBF for one asset: the job page's trend strip. */
export async function assetKpis(companyId: number, assetId: string) {
  const rows = await db.select({ createdAt: jobs.createdAt, completedAt: jobs.completedAt }).from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.assetId, assetId), eq(jobs.type, "Breakdown")))
    .orderBy(asc(jobs.createdAt));
  const now = new Date();
  const months: { month: string; breakdowns: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ month: d.toISOString().slice(0, 7), breakdowns: 0 });
  }
  for (const r of rows) {
    const m = months.find((x) => x.month === r.createdAt.toISOString().slice(0, 7));
    if (m) m.breakdowns++;
  }
  const repairs = rows.filter((r) => r.completedAt).map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
  const mttrHours = repairs.length ? round2(repairs.reduce((a, b) => a + b, 0) / repairs.length) : null;
  const mtbfDays = rows.length >= 2
    ? round2((rows[rows.length - 1].createdAt.getTime() - rows[0].createdAt.getTime()) / 86_400_000 / (rows.length - 1))
    : null;
  const [{ hours }] = await db.select({ hours: sql<string>`coalesce(sum(${jobLabour.hours}), 0)` }).from(jobLabour)
    .innerJoin(jobs, and(eq(jobs.companyId, jobLabour.companyId), eq(jobs.id, jobLabour.jobId)))
    .where(and(eq(jobLabour.companyId, companyId), eq(jobs.assetId, assetId), sql`${jobs.type} <> 'Planned'`));
  return { months, breakdownsTotal: rows.length, mttrHours, mtbfDays, repairHoursExcludingPlanned: round2(Number(hours)) };
}

export async function addLabour(companyId: number, jobId: string, input: z.infer<typeof labourEntrySchema>, actor: JobActor) {
  const userId = input.userId ?? actor.id;
  if (userId !== actor.id && !isLead(actor.role)) {
    throw new JobError("You can book your own hours. Booking hours for someone else is for Leads, Managers and Admins.", 403);
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  if (input.workDate > today) throw new JobError("Hours can't be booked for a future date.");
  return db.transaction(async (tx) => {
    await getJobOr404(tx, companyId, jobId);
    const [person] = await tx.select({ id: users.id, rate: users.hourlyRate }).from(users)
      .where(and(eq(users.companyId, companyId), eq(users.id, userId)));
    if (!person) throw new JobError("Engineer not found", 404);
    // Lock this person's day so two bookings can't both pass the 24-hour check.
    await tx.execute(sql`select pg_advisory_xact_lock(717171, ${userId})`);
    const [{ booked }] = await tx.select({ booked: sql<string>`coalesce(sum(${jobLabour.hours}), 0)` }).from(jobLabour)
      .where(and(eq(jobLabour.companyId, companyId), eq(jobLabour.userId, userId), eq(jobLabour.workDate, input.workDate)));
    if (Number(booked) + input.hours > 24) {
      throw new JobError(`That would be more than 24 hours on ${input.workDate} (already ${Number(booked)} h booked).`);
    }
    const [row] = await tx.insert(jobLabour).values({
      companyId, jobId, userId, workDate: input.workDate, hours: input.hours.toFixed(2),
      rate: person.rate, note: input.note ?? null, createdBy: actor.name,
    }).returning();
    return row;
  });
}

export async function deleteLabour(companyId: number, jobId: string, labourId: number, actor: JobActor) {
  const [row] = await db.select().from(jobLabour)
    .where(and(eq(jobLabour.companyId, companyId), eq(jobLabour.jobId, jobId), eq(jobLabour.id, labourId)));
  if (!row) throw new JobError("Time entry not found", 404);
  if (row.userId !== actor.id && !isManager(actor.role)) {
    throw new JobError("You can only remove your own time entries.", 403);
  }
  await db.delete(jobLabour).where(eq(jobLabour.id, labourId));
}

export async function addNote(companyId: number, jobId: string, input: z.infer<typeof jobNoteSchema>, actor: JobActor) {
  await getJobOr404(db, companyId, jobId);
  const [row] = await db.insert(jobNotes).values({ companyId, jobId, kind: input.kind, text: input.text, userName: actor.name }).returning();
  return row;
}

/** Turns a follow-up recommendation into a new job, linked both ways. */
export async function createFollowUpJob(companyId: number, jobId: string, noteId: number, input: z.infer<typeof followUpJobSchema>, actor: JobActor) {
  if (!isLead(actor.role)) throw new JobError("Only a Lead, Manager or Admin can raise follow-up jobs.", 403);
  const created = await db.transaction(async (tx) => {
    const source = await getJobOr404(tx, companyId, jobId);
    const [note] = await tx.select().from(jobNotes)
      .where(and(eq(jobNotes.companyId, companyId), eq(jobNotes.jobId, jobId), eq(jobNotes.id, noteId)))
      .for("update");
    if (!note) throw new JobError("Follow-up not found", 404);
    if (note.kind !== "Follow-up") throw new JobError("Only follow-up recommendations can become jobs.");
    if (note.followUpJobId) throw new JobError(`This follow-up is already job ${note.followUpJobId}.`, 409);
    const id = await nextNumber(tx, "jobs", "JOB", companyId);
    const [job] = await tx.insert(jobs).values({
      companyId, id,
      title: (input.title ?? note.text).slice(0, 200),
      description: `Follow-up from ${jobId}: ${note.text}`,
      assetId: source.assetId, type: input.type, priority: input.priority, status: "Open",
      assigneeId: input.assigneeId ?? null, dueDate: input.dueDate ?? null,
    }).returning();
    await tx.update(jobNotes).set({ followUpJobId: id }).where(eq(jobNotes.id, noteId));
    await tx.insert(jobNotes).values({ companyId, jobId: id, kind: "Note", text: `Raised as a follow-up from ${jobId}.`, userName: actor.name });
    return job;
  });
  onJobCreated(companyId, created, actor.id);
  return created;
}

/** Time entries for the signed-in person (or anyone, for Leads+) between two dates. */
export async function labourBetween(companyId: number, from: string, to: string) {
  return db.select().from(jobLabour)
    .where(and(eq(jobLabour.companyId, companyId), sql`${jobLabour.workDate} between ${from} and ${to}`))
    .orderBy(desc(jobLabour.workDate));
}
