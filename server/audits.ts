/**
 * Scheduling asset audits. An area audit is one audit row per asset in the chosen location,
 * each numbered AUD-00001… so it shows on the auditor's calendar and the Audits list.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { nextNumber } from "./numbering";
import { assetAudits, assets, locations, users, TRIAGE_ROLES } from "@shared/schema";

export class AuditError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const scheduleAuditSchema = z.object({
  locationId: z.string().trim().min(1).max(50),
  assigneeId: z.number().int().positive(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
}).strict();

const OPEN = ["Pending", "Scheduled"];

export async function scheduleAreaAudit(companyId: number, input: z.infer<typeof scheduleAuditSchema>, actor: { role: string }) {
  if (!(TRIAGE_ROLES as readonly string[]).includes(actor.role)) {
    throw new AuditError("Scheduling audits is for Leads, Managers and Admins.", 403);
  }
  return db.transaction(async (tx) => {
    const [loc] = await tx.select().from(locations).where(and(eq(locations.companyId, companyId), eq(locations.id, input.locationId)));
    if (!loc) throw new AuditError("That location doesn't exist.", 404);
    const [person] = await tx.select({ name: users.name }).from(users).where(and(eq(users.companyId, companyId), eq(users.id, input.assigneeId)));
    if (!person) throw new AuditError("That team member doesn't exist.", 404);

    const here = await tx.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.companyId, companyId), eq(assets.locationId, loc.id)));
    if (here.length === 0) throw new AuditError(`No assets are recorded at ${loc.name}, so there's nothing to audit there.`);

    // Don't double-book: skip assets that already have an open audit.
    const open = await tx.select({ assetId: assetAudits.assetId }).from(assetAudits)
      .where(and(eq(assetAudits.companyId, companyId), inArray(assetAudits.status, OPEN), inArray(assetAudits.assetId, here.map((a) => a.id))));
    const busy = new Set(open.map((o) => o.assetId));
    const todo = here.filter((a) => !busy.has(a.id));

    const created = [];
    for (const a of todo) {
      const id = await nextNumber(tx, "asset_audits", "AUD", companyId);
      const [row] = await tx.insert(assetAudits).values({
        id, companyId, assetId: a.id, status: "Scheduled", scheduledDate: input.scheduledDate,
        assignedTo: person.name, expectedLocation: loc.name,
      }).returning();
      created.push(row);
    }
    return { created: created.length, skipped: busy.size, location: loc.name, assignedTo: person.name };
  });
}
