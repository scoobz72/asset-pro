/**
 * Maintenance requests: submitted from the Request Portal, then triaged by a Lead, Manager
 * or Admin into a job, or rejected with a reason.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { maintenanceRequests, jobs, assets, users, TRIAGE_ROLES } from "@shared/schema";
import { URGENCY_PRIORITY } from "@shared/constants";
import type { z } from "zod";
import type { requestSubmitSchema, requestConvertSchema } from "@shared/schema";
import { nextNumber } from "./numbering";

export class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface RequestActor { id: number; name: string; role: string }

export const canTriage = (role: string) => (TRIAGE_ROLES as readonly string[]).includes(role);

async function checkAsset(tx: any, companyId: number, assetId: string | null | undefined) {
  if (!assetId) return;
  const [a] = await tx.select({ id: assets.id }).from(assets).where(and(eq(assets.companyId, companyId), eq(assets.id, assetId)));
  if (!a) throw new RequestError(`Asset ${assetId} not found`, 404);
}

export function submitRequest(companyId: number, input: z.infer<typeof requestSubmitSchema>, actor: RequestActor) {
  return db.transaction(async (tx) => {
    await checkAsset(tx, companyId, input.assetId);
    const id = await nextNumber(tx, "maintenance_requests", "REQ", companyId);
    const [created] = await tx.insert(maintenanceRequests).values({
      companyId,
      id,
      title: input.title,
      assetId: input.assetId ?? null,
      area: input.area ?? null,
      urgency: input.urgency,
      description: input.description ?? null,
      requestedBy: input.requestedBy?.trim() || actor.name,
      status: "Submitted",
      createdAt: new Date().toISOString(),
    }).returning();
    return created;
  });
}

async function lockRequest(tx: any, companyId: number, id: string) {
  const [r] = await tx.select().from(maintenanceRequests)
    .where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.id, id)))
    .for("update");
  if (!r) throw new RequestError(`Request ${id} not found`, 404);
  if (r.status !== "Submitted") {
    throw new RequestError(`${id} has already been ${r.status === "Converted" ? `turned into job ${r.jobId}` : "rejected"}.`, 409);
  }
  return r;
}

/** Turns a request into a job (one job per request) and links them. */
export function convertRequest(companyId: number, id: string, input: z.infer<typeof requestConvertSchema>, actor: RequestActor) {
  if (!canTriage(actor.role)) throw new RequestError("Only a Lead, Manager or Admin can triage requests.", 403);
  return db.transaction(async (tx) => {
    const request = await lockRequest(tx, companyId, id);
    if (input.assigneeId) {
      const [u] = await tx.select({ id: users.id }).from(users).where(and(eq(users.companyId, companyId), eq(users.id, input.assigneeId)));
      if (!u) throw new RequestError("Assignee not found", 404);
    }
    await checkAsset(tx, companyId, request.assetId);
    const jobId = await nextNumber(tx, "jobs", "JOB", companyId);
    const [job] = await tx.insert(jobs).values({
      companyId,
      id: jobId,
      title: (input.title ?? request.title).slice(0, 200),
      assetId: request.assetId ?? null,
      type: input.type,
      priority: input.priority ?? URGENCY_PRIORITY[request.urgency] ?? "Medium",
      status: "Open",
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
    }).returning();
    const [updated] = await tx.update(maintenanceRequests).set({
      status: "Converted", jobId, triagedBy: actor.name, triagedAt: new Date(), rejectionReason: null,
    }).where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.id, id))).returning();
    return { request: updated, job };
  });
}

export function rejectRequest(companyId: number, id: string, reason: string, actor: RequestActor) {
  if (!canTriage(actor.role)) throw new RequestError("Only a Lead, Manager or Admin can triage requests.", 403);
  return db.transaction(async (tx) => {
    await lockRequest(tx, companyId, id);
    const [updated] = await tx.update(maintenanceRequests).set({
      status: "Rejected", rejectionReason: reason, triagedBy: actor.name, triagedAt: new Date(),
    }).where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.id, id))).returning();
    return updated;
  });
}
