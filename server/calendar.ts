/**
 * The work calendar: everything someone can action, placed on its date.
 *  - Jobs on their due date: Technicians see jobs assigned to them or unassigned; Leads,
 *    Managers and Admins see all.
 *  - Requests waiting for triage, on the day submitted: Leads, Managers and Admins.
 *  - Asset audits on their scheduled date: the person assigned, plus Leads/Managers/Admins;
 *    audits with a discrepancy to resolve: Leads/Managers/Admins only.
 *  - Expected PO deliveries (sent, not fully received): everyone, as anyone can book goods in.
 * Overdue jobs and audits (date passed, still open) are returned separately.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { jobs, maintenanceRequests, assetAudits, purchaseOrders, assets, users, TRIAGE_ROLES } from "@shared/schema";

export type CalendarKind = "job" | "request" | "audit" | "delivery";

export interface CalendarItem {
  kind: CalendarKind;
  id: string;
  /** YYYY-MM-DD (UK date). */
  date: string;
  title: string;
  subtitle: string | null;
  status: string;
  /** Job type (Planned, Breakdown, Request) or request urgency / job priority. */
  category: string | null;
  priority: string | null;
  assignee: string | null;
  overdue: boolean;
}

export interface Viewer { id: number; name: string; role: string }

const isLead = (role: string) => (TRIAGE_ROLES as readonly string[]).includes(role);

/** Text or timestamp -> YYYY-MM-DD in the UK, or null if it isn't a date. */
export function ukDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}

const OPEN_JOB = (status: string) => status !== "Completed";
const OPEN_AUDIT = (status: string) => status === "Pending" || status === "Scheduled";

export async function calendarItems(companyId: number, viewer: Viewer, from: string, to: string) {
  const lead = isLead(viewer.role);
  const today = ukDate(new Date())!;
  const inRange = (d: string | null) => !!d && d >= from && d <= to;

  const [jobRows, assetRows, userRows] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.companyId, companyId)),
    db.select({ id: assets.id, name: assets.name }).from(assets).where(eq(assets.companyId, companyId)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.companyId, companyId)),
  ]);
  const assetName = new Map(assetRows.map((a) => [a.id, a.name]));
  const userName = new Map(userRows.map((u) => [u.id, u.name]));

  const items: CalendarItem[] = [];
  const overdue: CalendarItem[] = [];

  for (const j of jobRows) {
    if (!lead && j.assigneeId !== null && j.assigneeId !== viewer.id) continue;
    const date = ukDate(j.dueDate);
    if (!date) continue;
    const item: CalendarItem = {
      kind: "job", id: j.id, date, title: j.title,
      subtitle: j.assetId ? `${assetName.get(j.assetId) ?? j.assetId}` : null,
      status: j.status, category: j.type ?? null, priority: j.priority,
      assignee: j.assigneeId === null ? null : userName.get(j.assigneeId) ?? null,
      overdue: OPEN_JOB(j.status) && date < today,
    };
    if (inRange(date)) items.push(item);
    else if (item.overdue) overdue.push(item);
  }

  if (lead) {
    const reqs = await db.select().from(maintenanceRequests)
      .where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.status, "Submitted")));
    for (const r of reqs) {
      const date = ukDate(r.createdAt);
      if (!date) continue;
      const item: CalendarItem = {
        kind: "request", id: r.id, date, title: r.title,
        subtitle: [r.area, r.assetId ? assetName.get(r.assetId) ?? r.assetId : null].filter(Boolean).join(" • ") || null,
        status: r.status, category: r.urgency, priority: r.urgency, assignee: r.requestedBy, overdue: false,
      };
      // Waiting requests always show: on their date if in view, otherwise in the overdue list.
      if (inRange(date)) items.push(item);
      else if (date < from) overdue.push({ ...item, overdue: true });
    }
  }

  // Audits of one area, on one date, for one auditor show as a single entry ("12 assets").
  const audits = await db.select().from(assetAudits).where(eq(assetAudits.companyId, companyId));
  const groups = new Map<string, { item: CalendarItem; count: number; assetLabel: string | null }>();
  for (const a of audits) {
    const mine = (a.assignedTo ?? "").trim().toLowerCase() === viewer.name.trim().toLowerCase();
    const actionable = OPEN_AUDIT(a.status) ? (mine || lead) : a.status === "Discrepancy" ? lead : false;
    if (!actionable) continue;
    const date = ukDate(a.scheduledDate) ?? ukDate(a.completionDate);
    if (!date) continue;
    const status = OPEN_AUDIT(a.status) ? "Scheduled" : a.status;
    const key = [date, status, a.expectedLocation ?? "", (a.assignedTo ?? "").toLowerCase()].join("|");
    const g = groups.get(key);
    if (g) { g.count++; continue; }
    groups.set(key, {
      count: 1,
      assetLabel: a.assetId ? assetName.get(a.assetId) ?? a.assetId : null,
      item: {
        kind: "audit", id: a.id, date, title: "", subtitle: a.expectedLocation || null, status,
        category: null, priority: null, assignee: a.assignedTo ?? null,
        overdue: OPEN_AUDIT(a.status) && date < today,
      },
    });
  }
  for (const { item, count, assetLabel } of Array.from(groups.values())) {
    const what = count === 1 ? (assetLabel ?? "1 asset") : `${count} assets`;
    item.title = item.status === "Discrepancy"
      ? `Resolve audit discrepanc${count === 1 ? "y" : "ies"}: ${what}`
      : `Asset audit: ${what}`;
    if (inRange(item.date)) items.push(item);
    else if (item.overdue || item.status === "Discrepancy") overdue.push(item);
  }

  const pos = await db.select().from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, companyId), inArray(purchaseOrders.status, ["Sent", "Partially Received"])));
  for (const po of pos) {
    const date = ukDate(po.expectedDate);
    if (!date) continue;
    const item: CalendarItem = {
      kind: "delivery", id: po.id, date, title: `Delivery: ${po.vendor}`, subtitle: po.id,
      status: po.status, category: null, priority: null, assignee: null, overdue: date < today,
    };
    if (inRange(date)) items.push(item);
    else if (item.overdue) overdue.push(item);
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  overdue.sort((a, b) => a.date.localeCompare(b.date));
  return { from, to, today, canTriage: lead, items, overdue };
}
