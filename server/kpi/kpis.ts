/**
 * Engineering KPIs for the Reports page, for one company over a period (from..to, UK dates).
 * Each KPI carries its definition so the page can show how it is worked out.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users, jobs, jobLabour, shiftPatterns, absences, maintenanceRequests, inventory, stockLots, stockTransactions,
  PRIVILEGED_ROLES,
} from "@shared/schema";
import { UTILISATION_TARGET } from "@shared/constants";
import { ukDate } from "../calendar";
import { availableHours, utilisation, type Pattern, type AbsenceSpan } from "./availability";

const PPM_GRACE_DAYS = 7;
const REPEAT_WINDOW_DAYS = 7;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function engineeringKpis(companyId: number, from: string, to: string, viewerRole: string) {
  const today = ukDate(new Date())!;
  const end = to < today ? to : today; // nothing can be judged after today
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  const weeks = Math.max(days / 7, 1 / 7);
  const showCost = (PRIVILEGED_ROLES as readonly string[]).includes(viewerRole);

  const [people, patterns, offs, jobRows, labourRows, requests, parts] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.companyId, companyId)),
    db.select().from(shiftPatterns).where(eq(shiftPatterns.companyId, companyId)),
    db.select().from(absences).where(eq(absences.companyId, companyId)),
    db.select().from(jobs).where(eq(jobs.companyId, companyId)),
    db.select({
      userId: jobLabour.userId, hours: jobLabour.hours, rate: jobLabour.rate, workDate: jobLabour.workDate,
      jobId: jobLabour.jobId, type: jobs.type, assetId: jobs.assetId,
    }).from(jobLabour)
      .innerJoin(jobs, and(eq(jobs.companyId, jobLabour.companyId), eq(jobs.id, jobLabour.jobId)))
      .where(and(eq(jobLabour.companyId, companyId), sql`${jobLabour.workDate} between ${from} and ${to}`)),
    db.select().from(maintenanceRequests).where(eq(maintenanceRequests.companyId, companyId)),
    db.select().from(inventory).where(eq(inventory.companyId, companyId)),
  ]);

  // ---------------------------------------------------------------- utilisation
  const engineers = people.map((p) => {
    const pats: Pattern[] = patterns.filter((x) => x.userId === p.id).map((x) => ({
      effectiveFrom: x.effectiveFrom, mon: +x.mon, tue: +x.tue, wed: +x.wed, thu: +x.thu, fri: +x.fri, sat: +x.sat, sun: +x.sun,
    }));
    const spans: AbsenceSpan[] = offs.filter((a) => a.userId === p.id)
      .map((a) => ({ startDate: a.startDate, endDate: a.endDate, hoursPerDay: a.hoursPerDay === null ? null : +a.hoursPerDay }));
    const mine = labourRows.filter((l) => l.userId === p.id);
    const booked = mine.reduce((s, l) => s + +l.hours, 0);
    const planned = mine.filter((l) => l.type === "Planned").reduce((s, l) => s + +l.hours, 0);
    const available = availableHours(from, to, pats, spans);
    return {
      userId: p.id, name: p.name, role: p.role, hasShifts: pats.length > 0,
      available, booked: r2(booked), planned: r2(planned), reactive: r2(booked - planned),
      utilisation: utilisation(booked, available),
    };
  }).filter((e) => e.hasShifts || e.booked > 0);
  const teamAvailable = engineers.reduce((s, e) => s + e.available, 0);
  const teamBooked = engineers.reduce((s, e) => s + e.booked, 0);

  // ---------------------------------------------------------------- jobs
  const created = jobRows.filter((j) => { const d = ukDate(j.createdAt); return !!d && d >= from && d <= to; });
  const plannedHours = labourRows.filter((l) => l.type === "Planned").reduce((s, l) => s + +l.hours, 0);
  const allHours = labourRows.reduce((s, l) => s + +l.hours, 0);
  const plannedJobs = created.filter((j) => j.type === "Planned").length;

  const dueInPeriod = jobRows.filter((j) => { const d = ukDate(j.dueDate); return !!d && d >= from && d <= end; });
  const onTime = dueInPeriod.filter((j) => j.completedAt && ukDate(j.completedAt)! <= ukDate(j.dueDate)!).length;

  // PPM: judged once the grace period has passed (due + 7 days <= today).
  const ppmJudged = jobRows.filter((j) => {
    const d = j.type === "Planned" ? ukDate(j.dueDate) : null;
    return !!d && d >= from && d <= to && addDays(d, PPM_GRACE_DAYS) <= today;
  });
  const ppmOk = ppmJudged.filter((j) => j.completedAt && ukDate(j.completedAt)! <= addDays(ukDate(j.dueDate)!, PPM_GRACE_DAYS)).length;
  const ppmInGrace = jobRows.filter((j) => {
    const d = j.type === "Planned" ? ukDate(j.dueDate) : null;
    return !!d && d >= from && d <= to && addDays(d, PPM_GRACE_DAYS) > today && !j.completedAt;
  }).length;

  const breakdowns = jobRows.filter((j) => j.type === "Breakdown");
  const completedBreakdowns = breakdowns.filter((j) => { const d = ukDate(j.completedAt); return !!d && d >= from && d <= to; });
  const repairHours = completedBreakdowns.map((j) => (j.completedAt!.getTime() - j.createdAt.getTime()) / 3_600_000);
  const byAsset = new Map<string, number[]>();
  for (const j of breakdowns) {
    const d = ukDate(j.createdAt)!;
    if (!j.assetId || d < from || d > to) continue;
    if (!byAsset.has(j.assetId)) byAsset.set(j.assetId, []);
    byAsset.get(j.assetId)!.push(j.createdAt.getTime());
  }
  const gaps = Array.from(byAsset.values()).filter((t) => t.length >= 2)
    .map((t) => (Math.max(...t) - Math.min(...t)) / 86_400_000 / (t.length - 1));
  const repeats = completedBreakdowns.filter((j) => j.assetId && breakdowns.some((b) =>
    b.id !== j.id && b.assetId === j.assetId && b.createdAt > j.completedAt! &&
    b.createdAt.getTime() - j.completedAt!.getTime() <= REPEAT_WINDOW_DAYS * 86_400_000)).length;

  const open = jobRows.filter((j) => j.status !== "Completed");
  const completedInPeriod = jobRows.filter((j) => { const d = ukDate(j.completedAt); return !!d && d >= from && d <= to; }).length;
  const perWeek = completedInPeriod / weeks;
  const overdue = open.filter((j) => { const d = ukDate(j.dueDate); return !!d && d < today; }).length;
  const emergency = created.filter((j) => j.type === "Breakdown" && (j.priority === "Critical" || j.priority === "High")).length;

  // ---------------------------------------------------------------- requests
  const triaged = requests.filter((r) => r.triagedAt && ukDate(r.triagedAt)! >= from && ukDate(r.triagedAt)! <= to && r.createdAt);
  const responseHours = triaged.map((r) => (r.triagedAt!.getTime() - new Date(r.createdAt!).getTime()) / 3_600_000).filter((h) => h >= 0);
  const pending = requests.filter((r) => r.status === "Submitted");
  const oldestPendingDays = pending.length
    ? r1(Math.max(...pending.map((r) => (Date.now() - new Date(r.createdAt ?? Date.now()).getTime()) / 86_400_000)))
    : null;

  // ---------------------------------------------------------------- cost and stock
  const issues = await db.select({ value: stockTransactions.value, assetId: stockTransactions.assetId }).from(stockTransactions)
    .where(and(eq(stockTransactions.companyId, companyId), inArray(stockTransactions.type, ["Job Issue", "Return to Stores"]),
      sql`(${stockTransactions.createdAt} at time zone 'Europe/London')::date between ${from} and ${to}`));
  const partsCost = r2(issues.reduce((s, t) => s - Number(t.value ?? 0), 0));
  const labourCost = r2(labourRows.reduce((s, l) => s + (l.rate === null ? 0 : +l.hours * +l.rate), 0));
  const unratedHours = r2(labourRows.filter((l) => l.rate === null).reduce((s, l) => s + +l.hours, 0));
  const costByAsset = new Map<string, number>();
  for (const l of labourRows) if (l.assetId && l.rate !== null) costByAsset.set(l.assetId, (costByAsset.get(l.assetId) ?? 0) + +l.hours * +l.rate);
  for (const t of issues) if (t.assetId) costByAsset.set(t.assetId, (costByAsset.get(t.assetId) ?? 0) - Number(t.value ?? 0));
  const [{ value: stockValue }] = await db.select({ value: sql<string>`coalesce(sum(${stockLots.quantityRemaining} * ${stockLots.unitCost}), 0)` })
    .from(stockLots).where(eq(stockLots.companyId, companyId));

  return {
    from, to, today, showCost,
    targets: UTILISATION_TARGET,
    utilisation: {
      team: { available: r2(teamAvailable), booked: r2(teamBooked), utilisation: utilisation(teamBooked, teamAvailable) },
      engineers: engineers.sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1)),
      definition: "Hours booked to jobs ÷ shift hours available (shift pattern less absences).",
    },
    kpis: [
      { key: "plannedHours", label: "Planned work (hours)", value: pct(plannedHours, allHours), unit: "%", detail: `${r1(plannedHours)} of ${r1(allHours)} h booked were on Planned jobs`, target: "≥ 80% planned is world-class; 60–70% is typical", definition: "Hours on Planned jobs ÷ all hours booked to jobs." },
      { key: "plannedJobs", label: "Planned vs reactive jobs", value: pct(plannedJobs, created.length), unit: "%", detail: `${plannedJobs} planned, ${created.length - plannedJobs} reactive raised`, target: null, definition: "Planned jobs ÷ all jobs raised in the period." },
      { key: "schedule", label: "Schedule compliance", value: pct(onTime, dueInPeriod.length), unit: "%", detail: `${onTime} of ${dueInPeriod.length} jobs due were done by their due date`, target: "≥ 90%", definition: "Jobs completed on or before their due date ÷ jobs due in the period (up to today)." },
      { key: "ppm", label: "PPM compliance", value: pct(ppmOk, ppmJudged.length), unit: "%", detail: `${ppmOk} of ${ppmJudged.length} done within ${PPM_GRACE_DAYS} days of due${ppmInGrace ? `; ${ppmInGrace} still within grace` : ""}`, target: "≥ 95%", definition: `Planned jobs completed within ${PPM_GRACE_DAYS} days of their due date ÷ Planned jobs due in the period whose grace period has ended.` },
      { key: "mttr", label: "MTTR", value: repairHours.length ? r1(repairHours.reduce((a, b) => a + b, 0) / repairHours.length) : null, unit: "h", detail: `${repairHours.length} breakdown(s) completed`, target: "Lower is better", definition: "Mean time from a breakdown being raised to its completion." },
      { key: "mtbf", label: "MTBF", value: median(gaps) === null ? null : r1(median(gaps)!), unit: "days", detail: `${gaps.length} asset(s) with 2+ breakdowns`, target: "Higher is better", definition: "Median, across assets, of the average days between breakdowns raised in the period." },
      { key: "repeat", label: "Repeat failures", value: pct(repeats, completedBreakdowns.length), unit: "%", detail: `${repeats} of ${completedBreakdowns.length} fixes failed again within ${REPEAT_WINDOW_DAYS} days`, target: "< 5% (first-time fix > 95%)", definition: `Breakdowns completed in the period followed by another breakdown on the same asset within ${REPEAT_WINDOW_DAYS} days.` },
      { key: "emergency", label: "Emergency work", value: pct(emergency, created.length), unit: "%", detail: `${emergency} high/critical breakdowns of ${created.length} jobs raised`, target: "< 10%", definition: "Breakdown jobs raised with High or Critical priority ÷ all jobs raised." },
      { key: "backlog", label: "Backlog", value: perWeek > 0 ? r1(open.length / perWeek) : null, unit: "weeks", detail: `${open.length} open jobs; ${r1(perWeek)} completed per week`, target: "2–4 weeks", definition: "Open jobs ÷ jobs completed per week in the period." },
      { key: "overdue", label: "Overdue jobs", value: overdue, unit: "", detail: "Open jobs past their due date (today)", target: "0", definition: "Jobs not completed whose due date has passed." },
      { key: "response", label: "Request response", value: responseHours.length ? r1(responseHours.reduce((a, b) => a + b, 0) / responseHours.length) : null, unit: "h", detail: `${triaged.length} triaged; ${pending.length} waiting${oldestPendingDays !== null ? ` (oldest ${oldestPendingDays} days)` : ""}`, target: "< 24 h", definition: "Mean time from a request being submitted to being turned into a job or rejected." },
      { key: "stockouts", label: "Stock-outs", value: parts.filter((p) => p.stock === 0 && p.minStock > 0).length, unit: "parts", detail: `${parts.filter((p) => p.stock < p.minStock).length} below minimum stock`, target: "0", definition: "Parts with a minimum stock set and none in stock (today)." },
    ],
    cost: showCost ? {
      labour: labourCost, parts: partsCost, total: r2(labourCost + partsCost), unratedHours,
      stockValue: r2(Number(stockValue)),
      topAssets: Array.from(costByAsset, ([assetId, value]) => ({ assetId, value: r2(value) })).sort((a, b) => b.value - a.value).slice(0, 5),
      definition: "Labour (hours × each engineer's rate at the time) plus parts issued to jobs at FIFO cost, less returns.",
    } : null,
    notYetMeasured: [
      { label: "OEE (overall equipment effectiveness)", needs: "Production run data: planned run time, output and rejects per line." },
      { label: "Wrench time", needs: "A time study or hands-on-tool logging; booked hours include travel, waiting and admin." },
      { label: "MTTR / MTBF by failure mode", needs: "Failure and cause codes on breakdown jobs." },
      { label: "Maintenance cost as % of replacement asset value", needs: "Asset purchase values (coming with asset financials)." },
      { label: "Inventory turnover", needs: "A full year of costed stock movements (the ledger started in Nov 2026)." },
    ],
  };
}
