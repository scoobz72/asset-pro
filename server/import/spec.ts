/**
 * Column definitions for the Excel import. The template, the example workbook, the
 * parser and the validator are all built from this one file, so they can't drift apart.
 * See docs/data-import-plan.md section 3.
 */
import { LOCATION_TYPES, ASSET_STATUSES, CRITICALITIES, PART_UNITS } from "@shared/constants";
import { USER_ROLES } from "@shared/schema";

export type Kind =
  | "id"          // a record code: text, max 50
  | "text"        // free text, max 200 (or `max`)
  | "int"         // whole number >= 0
  | "money"       // >= 0, 2 dp, "£" and "," allowed
  | "rating"      // 0-5, 1 dp
  | "date"        // real Excel date or DD/MM/YYYY, not in the future
  | "email"
  | "list"        // one of `list`, case-insensitive
  | "categories"; // several values separated by ";"

export type TabKey =
  | "sites" | "locations" | "storeRooms" | "bins" | "suppliers"
  | "parts" | "assets" | "assetSpares" | "users";

export interface ColumnSpec {
  /** Header text exactly as it appears in the template. */
  header: string;
  /** Field name in the database model (Drizzle property). */
  key: string;
  kind: Kind;
  required?: boolean;
  list?: readonly string[];
  max?: number;
  /** For references: the tab whose IDs this column must match. */
  ref?: TabKey;
  /** Shown in the grey notes row of the template. */
  note: string;
  /** Column width in the template. */
  width?: number;
}

export interface TabSpec {
  key: TabKey;
  /** Worksheet name. */
  sheet: string;
  /** Singular label used in messages, e.g. "Site". */
  label: string;
  columns: ColumnSpec[];
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS_PER_TAB = 5000;
export const MAX_ROWS_TOTAL = 20000;
export const MAX_CELL_CHARS = 2000;
export const MAX_ERRORS_RETURNED = 200;
/** Template header is row 1, notes row 2, data from row 3. */
export const HEADER_ROW = 1;
export const NOTES_ROW = 2;
export const FIRST_DATA_ROW = 3;

const id = (header: string, note: string, extra: Partial<ColumnSpec> = {}): ColumnSpec =>
  ({ header, key: "id", kind: "id", required: true, note, width: 16, ...extra });

export const TABS: TabSpec[] = [
  {
    key: "sites", sheet: "Sites", label: "Site",
    columns: [
      id("Site ID", "Required. Your own code, e.g. SITE-01"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 30 },
      { header: "Address", key: "address", kind: "text", note: "Optional", width: 40 },
      { header: "Postcode", key: "postcode", kind: "text", max: 12, note: "Optional", width: 12 },
    ],
  },
  {
    key: "locations", sheet: "Asset Locations", label: "Location",
    columns: [
      id("Location ID", "Required. e.g. LINE-1"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 30 },
      { header: "Site ID", key: "siteId", kind: "id", required: true, ref: "sites", note: "Required. A Site ID", width: 16 },
      { header: "Type", key: "type", kind: "list", list: LOCATION_TYPES, note: "Pick from list (default Other)", width: 18 },
    ],
  },
  {
    key: "storeRooms", sheet: "Store Rooms", label: "Store room",
    columns: [
      id("Store Room ID", "Required. e.g. STORE-A"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 30 },
      { header: "Site ID", key: "siteId", kind: "id", required: true, ref: "sites", note: "Required. A Site ID", width: 16 },
    ],
  },
  {
    key: "bins", sheet: "Bins", label: "Bin",
    columns: [
      id("Bin ID", "Required. e.g. BIN-A01"),
      { header: "Store Room ID", key: "storeRoomId", kind: "id", required: true, ref: "storeRooms", note: "Required. A Store Room ID", width: 16 },
      { header: "Description", key: "description", kind: "text", note: "Optional, e.g. Rack A shelf 1", width: 30 },
    ],
  },
  {
    key: "suppliers", sheet: "Suppliers", label: "Supplier",
    columns: [
      id("Supplier ID", "Required. e.g. SUP-01"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 28 },
      { header: "Categories (separate with ;)", key: "categories", kind: "categories", note: "e.g. Bearings; Belts", width: 28 },
      { header: "Contact Name", key: "contactName", kind: "text", note: "Optional", width: 20 },
      { header: "Email", key: "email", kind: "email", note: "Optional", width: 26 },
      { header: "Phone", key: "phone", kind: "text", max: 40, note: "Optional", width: 16 },
      { header: "Lead Time (days)", key: "leadTimeDays", kind: "int", note: "Whole days", width: 14 },
      { header: "Rating (0–5)", key: "rating", kind: "rating", note: "0 to 5", width: 12 },
    ],
  },
  {
    key: "parts", sheet: "Parts", label: "Part",
    columns: [
      id("Part ID", "Required. e.g. BRG-6205"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 32 },
      { header: "Category", key: "category", kind: "text", required: true, note: "Required, e.g. Bearings", width: 16 },
      { header: "Unit", key: "unit", kind: "list", required: true, list: PART_UNITS, note: "Required. Pick from list", width: 8 },
      { header: "Unit Cost (£)", key: "unitCost", kind: "money", note: "e.g. 12.50", width: 12 },
      { header: "Stock Qty", key: "stock", kind: "int", note: "Changes are logged", width: 10 },
      { header: "Min Stock", key: "minStock", kind: "int", note: "Whole number", width: 10 },
      { header: "Reorder Qty", key: "reorderQty", kind: "int", note: "Whole number", width: 11 },
      { header: "Bin ID", key: "binId", kind: "id", ref: "bins", note: "A Bin ID", width: 12 },
      { header: "Lead Time (days)", key: "leadTime", kind: "int", note: "Whole days", width: 14 },
      { header: "Primary Supplier ID", key: "primarySupplierId", kind: "id", ref: "suppliers", note: "A Supplier ID", width: 18 },
      { header: "Secondary Supplier ID", key: "secondarySupplierId", kind: "id", ref: "suppliers", note: "A different Supplier ID", width: 20 },
      { header: "Manufacturer Part No", key: "manufacturerPartNo", kind: "text", max: 100, note: "Optional", width: 20 },
    ],
  },
  {
    key: "assets", sheet: "Assets", label: "Asset",
    columns: [
      id("Asset ID", "Required. e.g. L1-SLICER"),
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 30 },
      { header: "Location ID", key: "locationId", kind: "id", ref: "locations", note: "A Location ID", width: 14 },
      { header: "Category", key: "category", kind: "text", note: "e.g. Conveyor", width: 16 },
      { header: "Manufacturer", key: "manufacturer", kind: "text", note: "Optional", width: 16 },
      { header: "Model", key: "model", kind: "text", note: "Optional", width: 14 },
      { header: "Serial Number", key: "serialNumber", kind: "text", max: 100, note: "Optional", width: 16 },
      { header: "Criticality (A/B/C)", key: "criticality", kind: "list", list: CRITICALITIES, note: "A = most critical", width: 12 },
      { header: "Status", key: "status", kind: "list", list: ASSET_STATUSES, note: "Default Operational", width: 14 },
      { header: "Install Date", key: "installDate", kind: "date", note: "DD/MM/YYYY", width: 13 },
      { header: "Parent Asset ID", key: "parentAssetId", kind: "id", ref: "assets", note: "e.g. the line it belongs to", width: 16 },
    ],
  },
  {
    key: "assetSpares", sheet: "Asset Spares", label: "Spare",
    columns: [
      { header: "Asset ID", key: "assetId", kind: "id", required: true, ref: "assets", note: "Required. Replaces this asset's list", width: 16 },
      { header: "Part ID", key: "partId", kind: "id", required: true, ref: "parts", note: "Required", width: 16 },
      { header: "Quantity", key: "quantity", kind: "int", note: "Fitted per asset (default 1)", width: 12 },
    ],
  },
  {
    key: "users", sheet: "Users", label: "User",
    columns: [
      { header: "Name", key: "name", kind: "text", required: true, note: "Required", width: 24 },
      { header: "Email", key: "email", kind: "email", required: true, note: "Required. Signs in with this", width: 30 },
      { header: "Role", key: "role", kind: "list", required: true, list: USER_ROLES, note: "Required. Pick from list", width: 14 },
    ],
  },
];

export const TAB_BY_KEY: Record<TabKey, TabSpec> = Object.fromEntries(TABS.map((t) => [t.key, t])) as Record<TabKey, TabSpec>;

/** Header text compared loosely: case, spacing and the en dash in "0–5" don't matter. */
export function normaliseHeader(text: string): string {
  return text.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}
