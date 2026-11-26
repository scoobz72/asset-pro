import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp, boolean, jsonb, date, primaryKey, foreignKey, unique, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { LOCATION_TYPES, CRITICALITIES, STOCK_MOVEMENT_TYPES, CURRENCIES, HOME_CURRENCY } from "./constants";

/**
 * Multi-company model: every business record carries company_id, and record codes
 * (SITE-001, JOB-1001, ...) are unique per company via composite primary keys.
 * Composite foreign keys make it impossible to link records across companies.
 */
export const COMPANY_STATUSES = ["Active", "Suspended"] as const;

export * from "./constants";

export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  /** Stock, FIFO and reports are valued in this currency. */
  homeCurrency: text("home_currency").notNull().default(HOME_CURRENCY),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Submitted from the public "Request access" form; reviewed by the platform admin. */
export const accessRequests = pgTable("access_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const companyId = () => integer("company_id").notNull().references(() => companies.id);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Technician"),
  status: text("status").notNull().default("Available"),
  avatar: text("avatar"),
  email: text("email"),
  password: text("password"),
  /** Largest PO (home currency, ex-VAT) this person may approve; null = can't approve. */
  poApprovalLimit: numeric("po_approval_limit", { precision: 14, scale: 2 }),
  companyId: companyId(),
}, (t) => [
  unique("users_company_id_id_key").on(t.companyId, t.id),
  uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
]);

export const sites = pgTable("sites", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  postcode: text("postcode"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "sites_pkey" }),
]);

export const locations = pgTable("locations", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  siteId: text("site_id").notNull(),
  type: text("type").notNull().default("Other"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "locations_pkey" }),
  foreignKey({ name: "locations_site_fk", columns: [t.companyId, t.siteId], foreignColumns: [sites.companyId, sites.id] }),
]);

/** Where spare parts are kept: a store room belongs to a site and holds bins. */
export const storeRooms = pgTable("store_rooms", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  siteId: text("site_id").notNull(),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "store_rooms_pkey" }),
  foreignKey({ name: "store_rooms_site_fk", columns: [t.companyId, t.siteId], foreignColumns: [sites.companyId, sites.id] }),
]);

export const bins = pgTable("bins", {
  id: text("id").notNull(),
  storeRoomId: text("store_room_id").notNull(),
  description: text("description"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "bins_pkey" }),
  foreignKey({ name: "bins_store_room_fk", columns: [t.companyId, t.storeRoomId], foreignColumns: [storeRooms.companyId, storeRooms.id] }),
]);

export const assets = pgTable("assets", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  locationId: text("location_id"),
  status: text("status").notNull().default("Operational"),
  health: integer("health").notNull().default(100),
  lastService: text("last_service"),
  image: text("image"),
  category: text("category"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  criticality: text("criticality"),
  installDate: date("install_date"),
  parentAssetId: text("parent_asset_id"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "assets_pkey" }),
  foreignKey({ name: "assets_location_fk", columns: [t.companyId, t.locationId], foreignColumns: [locations.companyId, locations.id] }),
  foreignKey({ name: "assets_parent_fk", columns: [t.companyId, t.parentAssetId], foreignColumns: [t.companyId, t.id] }),
]);

export const assetParts = pgTable("asset_parts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assetId: text("asset_id").notNull(),
  partId: text("part_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  companyId: companyId(),
}, (t) => [
  unique("asset_parts_company_asset_part_key").on(t.companyId, t.assetId, t.partId),
  foreignKey({ name: "asset_parts_asset_fk", columns: [t.companyId, t.assetId], foreignColumns: [assets.companyId, assets.id] }),
  foreignKey({ name: "asset_parts_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
]);

export const inventory = pgTable("inventory", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  unit: text("unit").notNull().default("pcs"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  reorderQty: integer("reorder_qty"),
  binId: text("bin_id"),
  manufacturerPartNo: text("manufacturer_part_no"),
  lastUsed: text("last_used"),
  lastStockTaken: text("last_stock_taken"),
  lastReplenished: text("last_replenished"),
  leadTime: integer("lead_time").default(1),
  primarySupplierId: text("primary_supplier_id"),
  secondarySupplierId: text("secondary_supplier_id"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "inventory_pkey" }),
  foreignKey({ name: "inventory_bin_fk", columns: [t.companyId, t.binId], foreignColumns: [bins.companyId, bins.id] }),
  foreignKey({ name: "inventory_primary_supplier_fk", columns: [t.companyId, t.primarySupplierId], foreignColumns: [suppliers.companyId, suppliers.id] }),
  foreignKey({ name: "inventory_secondary_supplier_fk", columns: [t.companyId, t.secondarySupplierId], foreignColumns: [suppliers.companyId, suppliers.id] }),
]);

export const suppliers = pgTable("suppliers", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  leadTimeDays: integer("lead_time_days"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  /** Currency new POs to this supplier are raised in. */
  currency: text("currency").notNull().default(HOME_CURRENCY),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "suppliers_pkey" }),
]);

export const jobs = pgTable("jobs", {
  id: text("id").notNull(),
  title: text("title").notNull(),
  assetId: text("asset_id"),
  priority: text("priority").notNull().default("Medium"),
  status: text("status").notNull().default("Open"),
  assigneeId: integer("assignee_id"),
  dueDate: text("due_date"),
  templateId: text("template_id"),
  type: text("type").default("Breakdown"),
  /** Set by the database when the job is created; never accepted from the client. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Set by the server when the status becomes Completed, cleared if it is reopened. */
  completedAt: timestamp("completed_at", { withTimezone: true }),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "jobs_pkey" }),
  foreignKey({ name: "jobs_asset_fk", columns: [t.companyId, t.assetId], foreignColumns: [assets.companyId, assets.id] }),
  foreignKey({ name: "jobs_assignee_fk", columns: [t.companyId, t.assigneeId], foreignColumns: [users.companyId, users.id] }),
]);

export const templates = pgTable("templates", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Planned"),
  description: text("description"),
  steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`),
  signOffs: text("sign_offs").array().notNull().default(sql`'{}'::text[]`),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "templates_pkey" }),
]);

export const stockTransactions = pgTable("stock_transactions", {
  id: text("id").notNull(),
  date: text("date").notNull(),
  partId: text("part_id").notNull(),
  partName: text("part_name"),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  userId: text("user_id"),
  reference: text("reference"),
  /** When the movement was recorded (server time). `date` is kept for older rows. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** FIFO cost per unit of this movement (average across the lots it used, for "out"). */
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  /** Signed value: positive for stock in, negative for stock out. Null on pre-ledger rows. */
  value: numeric("value", { precision: 12, scale: 2 }),
  /** Stock on hand for the part straight after this movement. */
  balanceAfter: integer("balance_after"),
  jobId: text("job_id"),
  assetId: text("asset_id"),
  poId: text("po_id"),
  /** For purchases in another currency: what was paid per unit, and the rate used. */
  currency: text("currency"),
  originalUnitCost: numeric("original_unit_cost", { precision: 12, scale: 4 }),
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "stock_transactions_pkey" }),
  foreignKey({ name: "stock_transactions_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
  foreignKey({ name: "stock_transactions_job_fk", columns: [t.companyId, t.jobId], foreignColumns: [jobs.companyId, jobs.id] }),
  foreignKey({ name: "stock_transactions_asset_fk", columns: [t.companyId, t.assetId], foreignColumns: [assets.companyId, assets.id] }),
  index("stock_transactions_part_idx").on(t.companyId, t.partId, t.createdAt),
]);

/** A FIFO cost layer: one per receipt. Issues consume the oldest lots with stock left. */
export const stockLots = pgTable("stock_lots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  partId: text("part_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  quantityReceived: integer("quantity_received").notNull(),
  quantityRemaining: integer("quantity_remaining").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull().default("0"),
  transactionId: text("transaction_id"),
  currency: text("currency"),
  originalUnitCost: numeric("original_unit_cost", { precision: 12, scale: 4 }),
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
  companyId: companyId(),
}, (t) => [
  foreignKey({ name: "stock_lots_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
  index("stock_lots_open_idx").on(t.companyId, t.partId, t.receivedAt),
]);

/** One row per part per stock take, so each part's count history is kept. */
export const stockTakes = pgTable("stock_takes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  partId: text("part_id").notNull(),
  countedAt: timestamp("counted_at", { withTimezone: true }).notNull().defaultNow(),
  expected: integer("expected").notNull(),
  counted: integer("counted").notNull(),
  userName: text("user_name"),
  companyId: companyId(),
}, (t) => [
  foreignKey({ name: "stock_takes_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
  index("stock_takes_part_idx").on(t.companyId, t.partId, t.countedAt),
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").notNull(),
  /** Supplier name at the time the PO was raised. */
  vendor: text("vendor").notNull(),
  supplierId: text("supplier_id"),
  status: text("status").notNull().default("Draft"),
  /** Every PO has an explicit currency; amounts on the PO and its lines are in it. */
  currency: text("currency").notNull().default(HOME_CURRENCY),
  /** Ex-VAT total in the PO currency (sum of lines). */
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  /** Home-currency units per 1 unit of the PO currency, fixed when submitted for approval. */
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
  rateDate: date("rate_date"),
  rateSource: text("rate_source"),
  /** Total in the home currency at the submission rate: what approval limits are checked against. */
  totalHome: numeric("total_home", { precision: 12, scale: 2 }),
  requestedBy: text("requested_by"),
  date: text("date"),
  items: integer("items").notNull().default(0),
  jobId: text("job_id"),
  expectedDate: date("expected_date"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentById: integer("sent_by_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "purchase_orders_pkey" }),
  foreignKey({ name: "purchase_orders_supplier_fk", columns: [t.companyId, t.supplierId], foreignColumns: [suppliers.companyId, suppliers.id] }),
  foreignKey({ name: "purchase_orders_job_fk", columns: [t.companyId, t.jobId], foreignColumns: [jobs.companyId, jobs.id] }),
]);

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  poId: text("po_id").notNull(),
  lineNo: integer("line_no").notNull(),
  /** Null for non-stock items and services. */
  partId: text("part_id"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  /** Ex-VAT price per unit in the PO's currency. */
  unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  quantityReceived: integer("quantity_received").notNull().default(0),
  quantityCancelled: integer("quantity_cancelled").notNull().default(0),
  companyId: companyId(),
}, (t) => [
  foreignKey({ name: "purchase_order_lines_po_fk", columns: [t.companyId, t.poId], foreignColumns: [purchaseOrders.companyId, purchaseOrders.id] }).onDelete("cascade"),
  foreignKey({ name: "purchase_order_lines_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
  unique("purchase_order_lines_po_line_key").on(t.companyId, t.poId, t.lineNo),
]);

/** One delivery booked in against a PO. */
export const goodsReceipts = pgTable("goods_receipts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  poId: text("po_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  receivedBy: text("received_by"),
  deliveryNote: text("delivery_note"),
  /** Home-currency units per 1 unit of the PO currency used to value this delivery. */
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }).notNull(),
  rateDate: date("rate_date"),
  rateSource: text("rate_source"),
  companyId: companyId(),
}, (t) => [
  foreignKey({ name: "goods_receipts_po_fk", columns: [t.companyId, t.poId], foreignColumns: [purchaseOrders.companyId, purchaseOrders.id] }),
]);

export const goodsReceiptLines = pgTable("goods_receipt_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  receiptId: integer("receipt_id").notNull().references(() => goodsReceipts.id, { onDelete: "cascade" }),
  poLineId: integer("po_line_id").notNull().references(() => purchaseOrderLines.id),
  quantity: integer("quantity").notNull(),
  /** The stock movement it created (stock lines only). */
  transactionId: text("transaction_id"),
  companyId: companyId(),
});

/** Audit trail of everything done to a PO. */
export const poEvents = pgTable("po_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  poId: text("po_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userName: text("user_name"),
  action: text("action").notNull(),
  note: text("note"),
  companyId: companyId(),
}, (t) => [
  foreignKey({ name: "po_events_po_fk", columns: [t.companyId, t.poId], foreignColumns: [purchaseOrders.companyId, purchaseOrders.id] }).onDelete("cascade"),
  index("po_events_po_idx").on(t.companyId, t.poId, t.at),
]);

/** ECB daily reference rates (EUR-based), shared by all companies. */
export const exchangeRates = pgTable("exchange_rates", {
  rateDate: date("rate_date").notNull(),
  currency: text("currency").notNull(),
  /** Units of `currency` per 1 EUR. */
  perEur: numeric("per_eur", { precision: 18, scale: 8 }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.rateDate, t.currency], name: "exchange_rates_pkey" }),
]);

export const assetAudits = pgTable("asset_audits", {
  id: text("id").notNull(),
  assetId: text("asset_id").notNull(),
  status: text("status").notNull().default("Pending"),
  scheduledDate: text("scheduled_date"),
  assignedTo: text("assigned_to"),
  expectedLocation: text("expected_location"),
  verifiedLocation: text("verified_location"),
  completionDate: text("completion_date"),
  notes: text("notes"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "asset_audits_pkey" }),
  foreignKey({ name: "asset_audits_asset_fk", columns: [t.companyId, t.assetId], foreignColumns: [assets.companyId, assets.id] }),
]);

export const maintenanceRequests = pgTable("maintenance_requests", {
  id: text("id").notNull(),
  requestedBy: text("requested_by").notNull(),
  title: text("title").notNull(),
  assetId: text("asset_id"),
  area: text("area"),
  urgency: text("urgency").notNull().default("Medium"),
  description: text("description"),
  status: text("status").notNull().default("Submitted"),
  createdAt: text("created_at"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "maintenance_requests_pkey" }),
]);

// Generated identity columns are already excluded by drizzle-zod.
// Object schemas strip unknown keys, so only declared columns ever reach the database.
const numericInput = z.union([z.string(), z.number()]).transform((v) => String(v));

/** Runs the whole platform (creates companies). Never assignable through the API. */
export const PLATFORM_ADMIN_ROLE = "PlatformAdmin";
export const PRIVILEGED_ROLES = ["Manager", "Admin", PLATFORM_ADMIN_ROLE] as const;
/** Roles a company Manager/Admin may give to their own users. */
export const USER_ROLES = ["Manager", "Admin", "Lead", "Technician"] as const;

export const insertUserSchema = createInsertSchema(users, {
  poApprovalLimit: () => z.union([z.number(), z.string()]).transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 999_999_999_999, "Approval limit must be 0 or more")
    .transform((n) => n.toFixed(2)).nullable().optional(),
  name: (s) => s.trim().min(1).max(200),
  role: () => z.enum(USER_ROLES).optional(),
  email: () => z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  password: () => z.string().min(8).max(200).nullable().optional(),
}).omit({ companyId: true });
export const insertSiteSchema = createInsertSchema(sites).omit({ companyId: true });
export const insertLocationSchema = createInsertSchema(locations, {
  type: () => z.enum(LOCATION_TYPES).optional(),
}).omit({ companyId: true });
export const insertStoreRoomSchema = createInsertSchema(storeRooms).omit({ companyId: true });
export const insertBinSchema = createInsertSchema(bins).omit({ companyId: true });
export const insertAssetSchema = createInsertSchema(assets, {
  health: (s) => s.int().min(0).max(100),
  criticality: () => z.enum(CRITICALITIES).nullable().optional(),
  installDate: () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable().optional(),
}).omit({ companyId: true });
export const insertInventorySchema = createInsertSchema(inventory, {
  unitCost: () => numericInput.nullable().optional(),
  reorderQty: (s) => s.int().min(0).nullable().optional(),
}).omit({ companyId: true });
export const insertSupplierSchema = createInsertSchema(suppliers, {
  currency: () => z.enum(CURRENCIES).optional(),
  rating: () => numericInput.nullable().optional(),
  leadTimeDays: (s) => s.int().min(0).nullable().optional(),
  email: () => z.string().trim().toLowerCase().email().max(320).nullable().optional().or(z.literal("")),
}).omit({ companyId: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ companyId: true, createdAt: true, completedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ companyId: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ companyId: true });

/** A stock movement request. The server works out cost, balance and lots. */
export const stockMovementSchema = z.object({
  partId: z.string().trim().min(1).max(50),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  /** Units moved. Positive for in/out types; signed (non-zero) for adjustment types. */
  quantity: z.number().int().refine((n) => n !== 0, "Quantity can't be 0").refine((n) => Math.abs(n) <= 1_000_000, "Quantity is too large"),
  /** Cost per unit for stock coming in; defaults to the part's unit cost. Ignored for out. */
  unitCost: z.union([z.number(), z.string()]).transform((v) => Number(v)).refine((n) => Number.isFinite(n) && n >= 0 && n < 100_000_000, "Unit cost must be 0 or more").optional().nullable(),
  jobId: z.string().trim().min(1).max(50).optional().nullable(),
  assetId: z.string().trim().min(1).max(50).optional().nullable(),
  poId: z.string().trim().min(1).max(50).optional().nullable(),
  reference: z.string().trim().max(200).optional().nullable(),
}).strict();
export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const stockTakeSchema = z.object({
  counts: z.array(z.object({
    partId: z.string().trim().min(1).max(50),
    counted: z.number().int().min(0).max(1_000_000),
    /** Why the count differs (e.g. "Damaged"); saved as the adjustment's reference. */
    reason: z.string().trim().max(100).optional().nullable(),
  }).strict()).min(1).max(5000),
  reference: z.string().trim().max(200).optional().nullable(),
}).strict();
export type StockTakeInput = z.infer<typeof stockTakeSchema>;
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders, {
  total: () => numericInput.optional(),
}).omit({ companyId: true });

const money4 = z.union([z.number(), z.string()]).transform((v) => Number(String(v).replace(/[£€$,\s]/g, "")))
  .refine((n) => Number.isFinite(n) && n >= 0 && n < 100_000_000, "Price must be 0 or more");

/** A PO as the user edits it (Draft/Rejected). The server numbers it and works out totals. */
export const poDraftSchema = z.object({
  supplierId: z.string().trim().min(1).max(50),
  currency: z.enum(CURRENCIES).optional(),
  jobId: z.string().trim().min(1).max(50).optional().nullable(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(z.object({
    partId: z.string().trim().min(1).max(50).optional().nullable(),
    description: z.string().trim().max(300).optional().nullable(),
    quantity: z.number().int().min(1).max(1_000_000),
    unitPrice: money4,
  }).strict()).min(1, "Add at least one line").max(200),
}).strict();
export type PoDraftInput = z.infer<typeof poDraftSchema>;

export const poActionSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
  /** Manager/Admin only: home-currency units per 1 unit of the PO currency. */
  exchangeRate: z.number().positive().max(1_000_000).optional().nullable(),
}).strict();

export const goodsReceiptSchema = z.object({
  deliveryNote: z.string().trim().max(200).optional().nullable(),
  exchangeRate: z.number().positive().max(1_000_000).optional().nullable(),
  lines: z.array(z.object({
    lineId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(1_000_000),
  }).strict()).min(1, "Enter at least one received quantity").max(200),
}).strict();
export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;

export const reorderCreateSchema = z.object({
  items: z.array(z.object({
    partId: z.string().trim().min(1).max(50),
    quantity: z.number().int().min(1).max(1_000_000),
  }).strict()).min(1).max(1000),
}).strict();
export const insertAssetAuditSchema = createInsertSchema(assetAudits).omit({ companyId: true });
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({ companyId: true });

// Update schemas: every column optional, primary keys can never be changed.
export const updateUserSchema = insertUserSchema.partial();
export const updateSiteSchema = insertSiteSchema.omit({ id: true }).partial();
export const updateLocationSchema = insertLocationSchema.omit({ id: true }).partial();
export const updateStoreRoomSchema = insertStoreRoomSchema.omit({ id: true }).partial();
export const updateBinSchema = insertBinSchema.omit({ id: true }).partial();
export const updateAssetSchema = insertAssetSchema.omit({ id: true }).partial();
// Stock levels change only through stock movements (server/stock/ledger.ts), never by edit.
export const updateInventorySchema = insertInventorySchema.omit({ id: true, stock: true, lastUsed: true, lastStockTaken: true, lastReplenished: true }).partial();
export const updateSupplierSchema = insertSupplierSchema.omit({ id: true }).partial();
export const updateJobSchema = insertJobSchema.omit({ id: true }).partial();
export const updateTemplateSchema = insertTemplateSchema.omit({ id: true }).partial();
export const updatePurchaseOrderSchema = insertPurchaseOrderSchema.omit({ id: true }).partial();
export const updateAssetAuditSchema = insertAssetAuditSchema.omit({ id: true }).partial();
export const updateMaintenanceRequestSchema = insertMaintenanceRequestSchema.omit({ id: true }).partial();

/** Accepts either a list of part IDs (quantity 1 each) or a list of { partId, quantity }. */
export const assetPartsInputSchema = z.array(z.union([
  z.string().min(1),
  z.object({ partId: z.string().min(1), quantity: z.number().int().min(1).max(100000).default(1) }),
])).max(500).transform((items) => items.map((i) => typeof i === "string" ? { partId: i, quantity: 1 } : i));
export type AssetPartInput = { partId: string; quantity: number };

export const createCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  managerName: z.string().trim().min(1).max(200),
  managerEmail: z.string().trim().toLowerCase().email().max(320),
  managerPassword: z.string().min(8).max(200),
});
export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(COMPANY_STATUSES).optional(),
});
export const accessRequestInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Honeypot: real users never fill this in. */
  website: z.string().max(0).optional().or(z.literal("")),
});
export const ACCESS_REQUEST_STATUSES = ["New", "Done", "Dismissed"] as const;
export const updateAccessRequestSchema = z.object({ status: z.enum(ACCESS_REQUEST_STATUSES) });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertStoreRoom = z.infer<typeof insertStoreRoomSchema>;
export type InsertBin = z.infer<typeof insertBinSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type InsertAssetAudit = z.infer<typeof insertAssetAuditSchema>;
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;

export type Company = typeof companies.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;
export type User = typeof users.$inferSelect;
/** A user record that is safe to send to clients (never includes the password hash). */
export type PublicUser = Omit<User, "password">;
/** What /api/auth/me returns. */
export type SessionUser = PublicUser & { companyName: string };
export type Site = typeof sites.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type StoreRoom = typeof storeRooms.$inferSelect;
export type Bin = typeof bins.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InventoryItem = typeof inventory.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type StockLot = typeof stockLots.$inferSelect;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type GoodsReceiptLine = typeof goodsReceiptLines.$inferSelect;
export type PoEvent = typeof poEvents.$inferSelect;
export type StockTake = typeof stockTakes.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type AssetAudit = typeof assetAudits.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
