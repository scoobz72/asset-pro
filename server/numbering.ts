/**
 * Sequential record numbers per company (JOB-00001, REQ-00001...). The advisory lock makes
 * two people creating records at the same moment get different numbers.
 */
import { sql } from "drizzle-orm";
import type { db } from "./db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const LOCKS: Record<string, number> = { JOB: 616161, REQ: 626262 };

/** Next "PREFIX-00001"-style number for `table`, after the highest existing one. */
export async function nextNumber(tx: Tx, table: "jobs" | "maintenance_requests", prefix: "JOB" | "REQ", companyId: number): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(${LOCKS[prefix]}, ${companyId})`);
  const pattern = `^${prefix}-(\\d+)$`;
  const result = await tx.execute(sql`
    select coalesce(max((substring(id from ${pattern}))::bigint), 0) as max
    from ${sql.identifier(table)} where company_id = ${companyId}`);
  const max = Number((result.rows[0] as any)?.max ?? 0);
  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
}
