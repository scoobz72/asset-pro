/**
 * Available shift hours and utilisation (pure, no database).
 * Available hours on a day = the engineer's shift pattern for that weekday (latest pattern
 * effective on or before the day), less any absence: a whole-day absence removes the shift,
 * a part-day absence removes its hours. Utilisation = hours booked to jobs ÷ available hours.
 */

export interface Pattern {
  effectiveFrom: string;
  mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number;
}
export interface AbsenceSpan { startDate: string; endDate: string; hoursPerDay: number | null }

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Every YYYY-MM-DD from `from` to `to` inclusive (calendar days, no time zones involved). */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function shiftHoursOn(day: string, patterns: Pattern[]): number {
  let current: Pattern | undefined;
  for (const p of patterns) {
    if (p.effectiveFrom <= day && (!current || p.effectiveFrom > current.effectiveFrom)) current = p;
  }
  if (!current) return 0;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return Number(current[DAY_KEYS[weekday]]) || 0;
}

export function availableHoursOn(day: string, patterns: Pattern[], absences: AbsenceSpan[]): number {
  const shift = shiftHoursOn(day, patterns);
  if (shift === 0) return 0;
  let off = 0;
  for (const a of absences) {
    if (a.startDate <= day && day <= a.endDate) off = Math.max(off, a.hoursPerDay === null ? shift : a.hoursPerDay);
  }
  return Math.max(0, shift - off);
}

export function availableHours(from: string, to: string, patterns: Pattern[], absences: AbsenceSpan[]): number {
  return Math.round(eachDay(from, to).reduce((sum, d) => sum + availableHoursOn(d, patterns, absences), 0) * 100) / 100;
}

/** Booked ÷ available, or null when no shift hours are set for the period. */
export function utilisation(booked: number, available: number): number | null {
  return available > 0 ? Math.round((booked / available) * 1000) / 1000 : null;
}
