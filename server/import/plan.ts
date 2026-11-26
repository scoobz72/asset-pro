/**
 * Turns parsed rows plus the company's existing records into a plan: errors, per-tab
 * counts and the exact inserts/updates to make (plan sections 3.3 and 3.5).
 * Pure: no database access, so it can be unit-tested.
 */
import { PLATFORM_ADMIN_ROLE, PRIVILEGED_ROLES } from "@shared/schema";
import { TAB_BY_KEY, MAX_ERRORS_RETURNED, type TabKey, type ColumnSpec } from "./spec";
import type { ParsedWorkbook, ImportIssue, CellValue, ParsedRow } from "./parse";

/** Tabs whose rows are records with their own ID column. */
export const RECORD_TABS = ["sites", "locations", "storeRooms", "bins", "suppliers", "parts", "assets"] as const;
export type RecordTab = (typeof RECORD_TABS)[number];

export interface ExistingUser { id: number; name: string; email: string | null; role: string }

export interface Existing {
  records: Record<RecordTab, Map<string, Record<string, unknown>>>;
  /** assetId -> (partId -> quantity) */
  spares: Map<string, Map<string, number>>;
  users: ExistingUser[];
  /** Lower-case emails from the workbook that already belong to another company. */
  emailsElsewhere: Set<string>;
}

export interface Importer { id: number; name: string }

export type Action = "insert" | "update" | "unchanged";

export interface RecordOp {
  id: string;
  row: number;
  action: Action;
  /** Every non-blank cell of the row. */
  values: Record<string, CellValue>;
  /** Only the fields that differ from the existing record (updates). */
  changed: Record<string, CellValue>;
}

export interface SparesOp {
  assetId: string;
  parts: { partId: string; quantity: number }[];
  changed: boolean;
}

export interface UserOp {
  row: number;
  action: Action;
  userId?: number;
  name: string;
  email: string;
  role: string;
}

export interface StockChange { partId: string; partName: string; quantity: number }

export interface TabSummary {
  key: TabKey;
  tab: string;
  new: number;
  updated: number;
  unchanged: number;
  /** Asset Spares only: links removed because an asset's list was replaced. */
  removed?: number;
}

export interface ImportPlan {
  errors: ImportIssue[];
  errorCount: number;
  warnings: ImportIssue[];
  summary: TabSummary[];
  records: Record<RecordTab, RecordOp[]>;
  spares: SparesOp[];
  users: UserOp[];
  stockChanges: StockChange[];
}

/** Values compared as text, so "12.50" (database numeric) equals "12.50" (import). */
function same(existing: unknown, value: CellValue | undefined): boolean {
  const norm = (v: unknown) =>
    v === null || v === undefined ? "" : Array.isArray(v) ? v.join("\u0001") : String(v);
  return norm(existing) === norm(value);
}

const quote = (s: string) => `'${s}'`;

export function buildPlan(parsed: ParsedWorkbook, existing: Existing, importer: Importer): ImportPlan {
  const errors: ImportIssue[] = [...parsed.errors];
  const warnings: ImportIssue[] = [...parsed.warnings];
  const summary: TabSummary[] = [];
  const err = (tab: TabKey, row: number | undefined, column: string | undefined, message: string) =>
    errors.push({ tab: TAB_BY_KEY[tab].sheet, row, column, message });

  // IDs available to references: existing records plus rows in this workbook.
  const workbookIds = {} as Record<RecordTab, Set<string>>;
  for (const t of RECORD_TABS) {
    workbookIds[t] = new Set((parsed.tabs[t] ?? []).map((r) => r.values.id).filter((v): v is string => typeof v === "string"));
  }
  const exists = (t: RecordTab, id: string) => existing.records[t].has(id) || workbookIds[t].has(id);

  const checkRefs = (tab: TabKey, r: ParsedRow, columns: ColumnSpec[]) => {
    for (const col of columns) {
      if (!col.ref) continue;
      const v = r.values[col.key];
      if (typeof v !== "string") continue;
      if (!exists(col.ref as RecordTab, v)) {
        err(tab, r.row, col.header, `${col.header} ${quote(v)} not found: it isn't in your company or in the ${TAB_BY_KEY[col.ref].sheet} tab`);
      }
    }
  };

  // ------------------------------------------------------------ record tabs
  const records = {} as Record<RecordTab, RecordOp[]>;
  for (const t of RECORD_TABS) {
    records[t] = [];
    const rows = parsed.tabs[t];
    if (!rows) continue;
    const spec = TAB_BY_KEY[t];
    const idHeader = spec.columns[0].header;
    const firstSeen = new Map<string, number>();
    const s: TabSummary = { key: t, tab: spec.sheet, new: 0, updated: 0, unchanged: 0 };

    for (const r of rows) {
      const id = r.values.id;
      if (typeof id !== "string") continue; // "required" error already recorded
      const prev = firstSeen.get(id);
      if (prev !== undefined) {
        err(t, r.row, idHeader, `${idHeader} ${quote(id)} also appears on row ${prev}`);
        continue;
      }
      firstSeen.set(id, r.row);
      checkRefs(t, r, spec.columns);

      if (t === "parts" && r.values.primarySupplierId && r.values.primarySupplierId === r.values.secondarySupplierId) {
        err(t, r.row, "Secondary Supplier ID", "Secondary supplier must be different from the primary supplier");
      }
      if (t === "assets" && r.values.parentAssetId === id) {
        err(t, r.row, "Parent Asset ID", "An asset can't be its own parent");
      }

      const current = existing.records[t].get(id);
      if (!current) {
        records[t].push({ id, row: r.row, action: "insert", values: r.values, changed: r.values });
        s.new++;
        continue;
      }
      const changed: Record<string, CellValue> = {};
      for (const [k, v] of Object.entries(r.values)) {
        if (k !== "id" && !same(current[k], v)) changed[k] = v;
      }
      const action: Action = Object.keys(changed).length > 0 ? "update" : "unchanged";
      records[t].push({ id, row: r.row, action, values: r.values, changed });
      if (action === "update") s.updated++; else s.unchanged++;
    }
    summary.push(s);
  }

  // Parent-asset loops, checked over existing and imported assets together.
  if (parsed.tabs.assets) {
    const parentOf = new Map<string, string>();
    for (const [id, a] of existing.records.assets) {
      if (typeof a.parentAssetId === "string" && a.parentAssetId) parentOf.set(id, a.parentAssetId);
    }
    for (const op of records.assets) {
      const p = op.values.parentAssetId;
      if (typeof p === "string") parentOf.set(op.id, p);
    }
    for (const op of records.assets) {
      if (typeof op.values.parentAssetId !== "string" || op.values.parentAssetId === op.id) continue;
      const seen = new Set<string>([op.id]);
      let cur = op.values.parentAssetId;
      while (cur) {
        if (cur === op.id) {
          err("assets", op.row, "Parent Asset ID", `Parent chain loops back to ${quote(op.id)}`);
          break;
        }
        if (seen.has(cur)) break; // a loop that doesn't include this asset; reported on its own rows
        seen.add(cur);
        cur = parentOf.get(cur) as string;
      }
    }
  }

  // ------------------------------------------------------------ asset spares
  const spares: SparesOp[] = [];
  if (parsed.tabs.assetSpares) {
    const spec = TAB_BY_KEY.assetSpares;
    const s: TabSummary = { key: "assetSpares", tab: spec.sheet, new: 0, updated: 0, unchanged: 0, removed: 0 };
    const byAsset = new Map<string, Map<string, number>>();
    const pairRow = new Map<string, number>();
    for (const r of parsed.tabs.assetSpares) {
      const { assetId, partId } = r.values;
      if (typeof assetId !== "string" || typeof partId !== "string") continue;
      const pair = `${assetId}\u0001${partId}`;
      const prev = pairRow.get(pair);
      if (prev !== undefined) {
        err("assetSpares", r.row, "Part ID", `Part ${quote(partId)} is already listed for asset ${quote(assetId)} on row ${prev}`);
        continue;
      }
      pairRow.set(pair, r.row);
      checkRefs("assetSpares", r, spec.columns);
      const qty = typeof r.values.quantity === "number" ? r.values.quantity : 1;
      if (qty < 1) {
        err("assetSpares", r.row, "Quantity", "Quantity must be at least 1");
        continue;
      }
      if (!byAsset.has(assetId)) byAsset.set(assetId, new Map());
      byAsset.get(assetId)!.set(partId, qty);
    }
    for (const [assetId, wanted] of byAsset) {
      const current = existing.spares.get(assetId) ?? new Map<string, number>();
      let changed = false;
      for (const [partId, qty] of wanted) {
        const had = current.get(partId);
        if (had === undefined) { s.new++; changed = true; }
        else if (had !== qty) { s.updated++; changed = true; }
        else s.unchanged++;
      }
      for (const partId of current.keys()) {
        if (!wanted.has(partId)) { s.removed!++; changed = true; }
      }
      spares.push({ assetId, parts: Array.from(wanted, ([partId, quantity]) => ({ partId, quantity })), changed });
    }
    summary.push(s);
  }

  // ------------------------------------------------------------ users
  const users: UserOp[] = [];
  if (parsed.tabs.users) {
    const s: TabSummary = { key: "users", tab: TAB_BY_KEY.users.sheet, new: 0, updated: 0, unchanged: 0 };
    const byEmail = new Map(existing.users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
    const finalRole = new Map<string, string>(existing.users.map((u) => [`id:${u.id}`, u.role]));
    const firstSeen = new Map<string, number>();

    for (const r of parsed.tabs.users) {
      const { name, email, role } = r.values;
      if (typeof email !== "string" || typeof name !== "string" || typeof role !== "string") continue;
      const prev = firstSeen.get(email);
      if (prev !== undefined) {
        err("users", r.row, "Email", `Email also appears on row ${prev}`);
        continue;
      }
      firstSeen.set(email, r.row);
      if (existing.emailsElsewhere.has(email)) {
        // Deliberately vague: never reveal that the address belongs to another company.
        err("users", r.row, "Email", "This email can't be used");
        continue;
      }
      const current = byEmail.get(email);
      if (!current) {
        users.push({ row: r.row, action: "insert", name, email, role });
        finalRole.set(`new:${email}`, role);
        s.new++;
        continue;
      }
      if (role !== current.role && current.role === PLATFORM_ADMIN_ROLE) {
        err("users", r.row, "Role", "This user's role can't be changed by import");
        continue;
      }
      if (role !== current.role && current.id === importer.id) {
        err("users", r.row, "Role", "You can't change your own role");
        continue;
      }
      finalRole.set(`id:${current.id}`, role);
      const action: Action = name !== current.name || role !== current.role ? "update" : "unchanged";
      users.push({ row: r.row, action, userId: current.id, name, email, role });
      if (action === "update") s.updated++; else s.unchanged++;
    }
    const privileged = Array.from(finalRole.values()).filter((r) => (PRIVILEGED_ROLES as readonly string[]).includes(r)).length;
    if (privileged === 0) err("users", undefined, "Role", "The import would leave the company without a Manager or Admin");
    summary.push(s);
  }

  // ------------------------------------------------------------ stock changes (3.5)
  const stockChanges: StockChange[] = [];
  for (const op of records.parts) {
    const current = existing.records.parts.get(op.id);
    const name = String(op.values.name ?? current?.name ?? op.id);
    if (op.action === "insert" && typeof op.values.stock === "number" && op.values.stock > 0) {
      stockChanges.push({ partId: op.id, partName: name, quantity: op.values.stock });
    } else if (op.action === "update" && typeof op.changed.stock === "number") {
      const diff = op.changed.stock - Number(current?.stock ?? 0);
      if (diff !== 0) stockChanges.push({ partId: op.id, partName: name, quantity: diff });
    }
  }

  // Errors in sheet order, then row order.
  const order = new Map<string, number>(Object.values(TAB_BY_KEY).map((t, i) => [t.sheet, i]));
  errors.sort((a, b) => (order.get(a.tab ?? "") ?? 99) - (order.get(b.tab ?? "") ?? 99) || (a.row ?? 0) - (b.row ?? 0));

  return {
    errors: errors.slice(0, MAX_ERRORS_RETURNED),
    errorCount: errors.length,
    warnings,
    summary,
    records,
    spares,
    users,
    stockChanges,
  };
}
