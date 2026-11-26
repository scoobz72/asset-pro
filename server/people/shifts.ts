/**
 * Engineers' shift patterns and absences: what utilisation is measured against.
 * Managers and Admins maintain them; anyone can see their own.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { shiftPatterns, absences, users, PRIVILEGED_ROLES } from "@shared/schema";
import type { z } from "zod";
import type { shiftPatternSchema, absenceSchema } from "@shared/schema";

export class ShiftError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
export interface ShiftActor { id: number; role: string }
const isManager = (role: string) => (PRIVILEGED_ROLES as readonly string[]).includes(role);

async function checkUser(companyId: number, userId: number) {
  const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.companyId, companyId), eq(users.id, userId)));
  if (!u) throw new ShiftError("Engineer not found", 404);
}

function mustManage(actor: ShiftActor) {
  if (!isManager(actor.role)) throw new ShiftError("Only a Manager or Admin can change shift hours and absences.", 403);
}

export async function getShifts(companyId: number, userId: number, actor: ShiftActor) {
  if (userId !== actor.id && !isManager(actor.role)) throw new ShiftError("You can only see your own shifts.", 403);
  await checkUser(companyId, userId);
  const patterns = await db.select().from(shiftPatterns)
    .where(and(eq(shiftPatterns.companyId, companyId), eq(shiftPatterns.userId, userId)))
    .orderBy(asc(shiftPatterns.effectiveFrom));
  const off = await db.select().from(absences)
    .where(and(eq(absences.companyId, companyId), eq(absences.userId, userId)))
    .orderBy(asc(absences.startDate));
  return { patterns, absences: off };
}

/** Adds a pattern from a date, or replaces the one starting on that exact date. */
export async function savePattern(companyId: number, userId: number, input: z.infer<typeof shiftPatternSchema>, actor: ShiftActor) {
  mustManage(actor);
  await checkUser(companyId, userId);
  const values = {
    mon: input.mon.toFixed(2), tue: input.tue.toFixed(2), wed: input.wed.toFixed(2), thu: input.thu.toFixed(2),
    fri: input.fri.toFixed(2), sat: input.sat.toFixed(2), sun: input.sun.toFixed(2),
  };
  const [row] = await db.insert(shiftPatterns).values({ companyId, userId, effectiveFrom: input.effectiveFrom, ...values })
    .onConflictDoUpdate({ target: [shiftPatterns.companyId, shiftPatterns.userId, shiftPatterns.effectiveFrom], set: values })
    .returning();
  return row;
}

export async function deletePattern(companyId: number, userId: number, patternId: number, actor: ShiftActor) {
  mustManage(actor);
  await db.delete(shiftPatterns).where(and(eq(shiftPatterns.companyId, companyId), eq(shiftPatterns.userId, userId), eq(shiftPatterns.id, patternId)));
}

export async function addAbsence(companyId: number, userId: number, input: z.infer<typeof absenceSchema>, actor: ShiftActor) {
  mustManage(actor);
  await checkUser(companyId, userId);
  const [row] = await db.insert(absences).values({
    companyId, userId, startDate: input.startDate, endDate: input.endDate,
    hoursPerDay: input.hoursPerDay === null || input.hoursPerDay === undefined ? null : input.hoursPerDay.toFixed(2),
    reason: input.reason, note: input.note ?? null,
  }).returning();
  return row;
}

export async function deleteAbsence(companyId: number, userId: number, absenceId: number, actor: ShiftActor) {
  mustManage(actor);
  await db.delete(absences).where(and(eq(absences.companyId, companyId), eq(absences.userId, userId), eq(absences.id, absenceId)));
}
