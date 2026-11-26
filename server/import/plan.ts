/**
 * Turns parsed rows plus the company's existing records into a plan: errors, per-tab
 * counts and the exact inserts/updates to make (plan sections 3.3 and 3.5).
 * Pure: no database access, so it can be unit-tested.
 */
import { PLATFORM_ADMIN_ROLE, PRIVILEGED_ROLES, ADMIN_ROLES } from "@shared/schema";
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

export interface Importer {
  id: number;
  name: string;
  /** Only Admins may import users (adding people and setting roles is Admin-only). */
  role?: string;
}

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

const withArticle = (label: string) => `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label.toLowerCase()}`;

/** A row's cells as one comparable string, for spotting exact repeats. */
function rowKey(values: Record<string, CellValue>): string {
  return JSON.stringify(Object.keys(values).sort().map((k) => [k, values[k]]));
}

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

  // People often type a name where an ID is expected ("HFC Production" for SITE-01).
  // When a reference isn't an ID but matches exactly one record's name, the ID is used
  // instead and the substitution is listed as a warning in the preview.
  // People often type a name where an ID is expected ("HFC Production" for SITE-01), or an
  // ID in different letter case. When a reference matches exactly one record by ID (ignoring
  // case) or by name, that record's ID is used and the substitution is listed as a warning.
  const lookup = new Map<RecordTab, { ids: Map<string, Set<string>>; names: Map<string, Set<string>> }>();
  const indexFor = (t: RecordTab) => {
    if (!lookup.has(t)) {
      const ids = new Map<string, Set<string>>();
      const names = new Map<string, Set<string>>();
      const add = (map: Map<string, Set<string>>, key: unknown, id: string) => {
        if (typeof key !== "string" || !key.trim()) return;
        const k = key.trim().toLowerCase();
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(id);
      };
      const addRecord = (id: unknown, name: unknown) => {
        if (typeof id !== "string") return;
        add(ids, id, id);
        add(names, name, id);
      };
      for (const [id, rec] of Array.from(existing.records[t])) addRecord(id, rec.name);
      for (const r of parsed.tabs[t] ?? []) addRecord(r.values.id, r.values.name);
      lookup.set(t, { ids, names });
    }
    return lookup.get(t)!;
  };
  const find = (t: RecordTab, text: string) => {
    const k = text.trim().toLowerCase();
    const index = indexFor(t);
    const byId = Array.from(index.ids.get(k) ?? []);
    if (byId.length > 0) return { how: "ID", matches: byId };
    return { how: "name", matches: Array.from(index.names.get(k) ?? []) };
  };
  const substitutions = new Map<string, { tab: TabKey; column: string; text: string; id: string; how: string; rows: number[] }>();

  const checkRefs = (tab: TabKey, r: ParsedRow, columns: ColumnSpec[]) => {
    for (const col of columns) {
      if (!col.ref) continue;
      const v = r.values[col.key];
      if (typeof v !== "string") continue;
      const target = col.ref as RecordTab;
      if (exists(target, v)) continue;
      const label = TAB_BY_KEY[col.ref].label;
      const { how, matches } = find(target, v);
      if (matches.length === 1) {
        r.values[col.key] = matches[0];
        const key = `${tab}\u0001${col.header}\u0001${v}`;
        if (!substitutions.has(key)) substitutions.set(key, { tab, column: col.header, text: v, id: matches[0], how, rows: [] });
        substitutions.get(key)!.rows.push(r.row);
        continue;
      }
      if (matches.length > 1) {
        err(tab, r.row, col.header, `${quote(v)} matches ${matches.length} ${label.toLowerCase()}s (${matches.join(", ")}). Use the exact ${col.header}`);
        continue;
      }
      // Not found: say so, and point out if the value belongs to a different kind of record.
      const elsewhere = RECORD_TABS.filter((t) => t !== target && find(t, v).matches.length > 0);
      const hint = elsewhere.length > 0
        ? ` It looks like ${elsewhere.map((t) => `${withArticle(TAB_BY_KEY[t].label)} (${TAB_BY_KEY[t].sheet} tab)`).join(" or ")}, not ${withArticle(label)}.`
        : ` Add it to the ${TAB_BY_KEY[col.ref].sheet} tab or use an existing ${col.header}.`;
      err(tab, r.row, col.header, `${col.header} ${quote(v)} not found.${hint}`);
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
    // First row for each ID, with its cells as typed (before any name -> ID substitution).
    const firstSeen = new Map<string, { row: number; typed: string }>();
    const repeats = new Map<string, number[]>();
    const s: TabSummary = { key: t, tab: spec.sheet, new: 0, updated: 0, unchanged: 0 };

    for (const r of rows) {
      const id = r.values.id;
      if (typeof id !== "string") continue; // "required" error already recorded
      const typed = rowKey(r.values);
      const prev = firstSeen.get(id);
      if (prev !== undefined) {
        // An exact repeat (e.g. a bin listed once per part) is harmless: import it once.
        if (prev.typed === typed) {
          if (!repeats.has(id)) repeats.set(id, []);
          repeats.get(id)!.push(r.row);
        } else {
          err(t, r.row, idHeader, `${idHeader} ${quote(id)} also appears on row ${prev.row} with different details`);
        }
        continue;
      }
      firstSeen.set(id, { row: r.row, typed });
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
    if (repeats.size > 0) {
      const ids = Array.from(repeats.keys());
      const count = Array.from(repeats.values()).reduce((n, rs) => n + rs.length, 0);
      warnings.push({
        tab: spec.sheet,
        column: idHeader,
        message: `${count} repeated row${count === 1 ? "" : "s"} ignored (identical to an earlier row): ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ` and ${ids.length - 8} more` : ""}`,
      });
    }
    summary.push(s);
  }

  // Parent-asset loops, checked over existing and imported assets together.
  if (parsed.tabs.assets) {
    const parentOf = new Map<string, string>();
    for (const [id, a] of Array.from(existing.records.assets)) {
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
      // References first, so a part named instead of its ID is resolved before duplicate checks.
      checkRefs("assetSpares", r, spec.columns);
      const { assetId, partId } = r.values;
      if (typeof assetId !== "string" || typeof partId !== "string") continue;
      const pair = `${assetId}\u0001${partId}`;
      const prev = pairRow.get(pair);
      if (prev !== undefined) {
        err("assetSpares", r.row, "Part ID", `Part ${quote(partId)} is already listed for asset ${quote(assetId)} on row ${prev}`);
        continue;
      }
      pairRow.set(pair, r.row);
      const qty = typeof r.values.quantity === "number" ? r.values.quantity : 1;
      if (qty < 1) {
        err("assetSpares", r.row, "Quantity", "Quantity must be at least 1");
        continue;
      }
      if (!byAsset.has(assetId)) byAsset.set(assetId, new Map());
      byAsset.get(assetId)!.set(partId, qty);
    }
    for (const [assetId, wanted] of Array.from(byAsset)) {
      const current = existing.spares.get(assetId) ?? new Map<string, number>();
      let changed = false;
      for (const [partId, qty] of Array.from(wanted)) {
        const had = current.get(partId);
        if (had === undefined) { s.new++; changed = true; }
        else if (had !== qty) { s.updated++; changed = true; }
        else s.unchanged++;
      }
      for (const partId of Array.from(current.keys())) {
        if (!wanted.has(partId)) { s.removed!++; changed = true; }
      }
      spares.push({ assetId, parts: Array.from(wanted, ([partId, quantity]) => ({ partId, quantity })), changed });
    }
    summary.push(s);
  }

  // ------------------------------------------------------------ users
  const users: UserOp[] = [];
  if (parsed.tabs.users && parsed.tabs.users.length > 0 && !(ADMIN_ROLES as readonly string[]).includes(importer.role ?? "")) {
    err("users", undefined, undefined, "Only an Admin can import users. Leave the Users tab empty, or ask an Admin to run the import.");
  } else if (parsed.tabs.users) {
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

  for (const m of Array.from(substitutions.values())) {
    const rows = m.rows.length === 1 ? `row ${m.rows[0]}` : `${m.rows.length} rows`;
    warnings.push({
      tab: TAB_BY_KEY[m.tab].sheet,
      column: m.column,
      message: `${quote(m.text)} matched by ${m.how} to ${m.column} ${quote(m.id)} (${rows})`,
    });
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
