/**
 * Database side of the import: loads the company's existing records, and applies a plan
 * in one transaction (plan section 3.5). Preview and commit both validate the same way.
 */
import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  sites, locations, storeRooms, bins, suppliers, inventory, assets, assetParts,
  users,
} from "@shared/schema";
import { setStockTo } from "../stock/ledger";
import { parseWorkbook } from "./parse";
import { buildPlan, RECORD_TABS, type Existing, type ImportPlan, type Importer, type RecordTab, type TabSummary } from "./plan";
import type { ImportIssue } from "./parse";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

const TABLES = {
  sites, locations, storeRooms, bins, suppliers, parts: inventory, assets,
} as const;

/** Namespace for pg_advisory_xact_lock(int, int): one import per company at a time. */
const IMPORT_LOCK_NAMESPACE = 424242;
const BATCH = 500;

export interface ImportResult {
  ok: boolean;
  summary: TabSummary[];
  errors: ImportIssue[];
  errorCount: number;
  warnings: ImportIssue[];
  stockAdjustments: number;
}

/** Raised inside the transaction when validation fails, so nothing is written. */
export class ImportInvalidError extends Error {
  status = 422;
  constructor(public result: ImportResult) {
    super("Import has errors");
  }
}

function toResult(plan: ImportPlan): ImportResult {
  return {
    ok: plan.errorCount === 0,
    summary: plan.summary,
    errors: plan.errors,
    errorCount: plan.errorCount,
    warnings: plan.warnings,
    stockAdjustments: plan.stockChanges.length,
  };
}

async function loadExisting(q: Db, companyId: number, workbookEmails: string[]): Promise<Existing> {
  const records = {} as Existing["records"];
  for (const t of RECORD_TABS) {
    const table = TABLES[t] as any;
    const rows: any[] = await q.select().from(table).where(eq(table.companyId, companyId));
    records[t] = new Map(rows.map((r) => [r.id as string, r]));
  }
  const spareRows = await q.select({ assetId: assetParts.assetId, partId: assetParts.partId, quantity: assetParts.quantity })
    .from(assetParts).where(eq(assetParts.companyId, companyId));
  const spares = new Map<string, Map<string, number>>();
  for (const s of spareRows) {
    if (!spares.has(s.assetId)) spares.set(s.assetId, new Map());
    spares.get(s.assetId)!.set(s.partId, s.quantity);
  }
  const userRows = await q.select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users).where(eq(users.companyId, companyId));

  let emailsElsewhere = new Set<string>();
  if (workbookEmails.length > 0) {
    const lowerEmail = sql<string>`lower(${users.email})`;
    const taken = await q.select({ email: lowerEmail }).from(users)
      .where(and(ne(users.companyId, companyId), inArray(lowerEmail, workbookEmails)));
    emailsElsewhere = new Set(taken.map((t) => t.email));
  }
  return { records, spares, users: userRows, emailsElsewhere };
}

function emailsIn(parsed: Awaited<ReturnType<typeof parseWorkbook>>): string[] {
  return Array.from(new Set((parsed.tabs.users ?? []).map((r) => r.values.email).filter((e): e is string => typeof e === "string")));
}

/** Validates and counts, writing nothing. */
export async function previewImport(buf: Buffer, companyId: number, importer: Importer): Promise<ImportResult> {
  const parsed = await parseWorkbook(buf);
  const existing = await loadExisting(db, companyId, emailsIn(parsed));
  return toResult(buildPlan(parsed, existing, importer));
}

/** Re-validates against the current data and applies everything, or nothing. */
export async function commitImport(buf: Buffer, companyId: number, importer: Importer): Promise<ImportResult> {
  const parsed = await parseWorkbook(buf);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${IMPORT_LOCK_NAMESPACE}, ${companyId})`);
    const existing = await loadExisting(tx, companyId, emailsIn(parsed));
    const plan = buildPlan(parsed, existing, importer);
    if (plan.errorCount > 0) throw new ImportInvalidError(toResult(plan));
    await applyPlan(tx, plan, companyId, importer);
    return toResult(plan);
  });
}

async function insertBatched(tx: Tx, table: any, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await tx.insert(table).values(rows.slice(i, i + BATCH));
  }
}

async function applyPlan(tx: Tx, plan: ImportPlan, companyId: number, importer: Importer) {
  // Order matters: each tab only references tabs before it (assets' parents are set last).
  for (const t of RECORD_TABS as readonly RecordTab[]) {
    const table = TABLES[t] as any;
    const ops = plan.records[t];
    const inserts = ops.filter((o) => o.action === "insert").map((o) => {
      // Asset parents are set in a second pass; part stock goes through the ledger below.
      const { parentAssetId: _deferred, stock: _stock, ...values } = o.values;
      if (t === "assets") return { ...values, companyId };
      if (t === "parts") return { ...values, stock: 0, companyId };
      return { ...o.values, companyId };
    });
    await insertBatched(tx, table, inserts);
    for (const op of ops.filter((o) => o.action === "update")) {
      // Asset parents are set in the second pass below.
      const { id: _id, parentAssetId: _deferred, stock: _stock, ...set } = op.changed;
      if (Object.keys(set).length === 0) continue;
      await tx.update(table).set(set).where(and(eq(table.companyId, companyId), eq(table.id, op.id)));
    }
  }
  // Second pass for assets: parents, now that every asset in the workbook exists.
  for (const op of plan.records.assets) {
    const parent = op.action === "insert" ? op.values.parentAssetId : op.changed.parentAssetId;
    if (typeof parent !== "string") continue;
    await tx.update(assets).set({ parentAssetId: parent })
      .where(and(eq(assets.companyId, companyId), eq(assets.id, op.id)));
  }

  // Asset spares: each asset in the tab gets exactly the listed parts (decision 7.2).
  for (const s of plan.spares.filter((s) => s.changed)) {
    await tx.delete(assetParts).where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, s.assetId)));
    if (s.parts.length > 0) {
      await tx.insert(assetParts).values(s.parts.map((p) => ({ companyId, assetId: s.assetId, partId: p.partId, quantity: p.quantity })));
    }
  }

  // Users: created without a password; only name and role are ever updated.
  const newUsers = plan.users.filter((u) => u.action === "insert")
    .map((u) => ({ companyId, name: u.name, email: u.email, role: u.role }));
  await insertBatched(tx, users, newUsers);
  for (const u of plan.users.filter((u) => u.action === "update")) {
    await tx.update(users).set({ name: u.name, role: u.role })
      .where(and(eq(users.companyId, companyId), eq(users.id, u.userId!)));
  }

  // Stock levels go through the ledger, so each change creates or uses FIFO lots and is
  // logged with its cost: opening stock for new parts, an adjustment for existing ones.
  for (const op of plan.records.parts) {
    const target = op.action === "insert" ? op.values.stock : op.changed.stock;
    if (typeof target !== "number") continue;
    await setStockTo(tx, companyId, op.id, target, op.action === "insert" ? "Stock In" : "Import Adjustment",
      { name: importer.name }, "Excel import");
  }
}
