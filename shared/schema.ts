import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp, boolean, jsonb, date, primaryKey, foreignKey, unique, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { LOCATION_TYPES, CRITICALITIES } from "./constants";

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
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "stock_transactions_pkey" }),
  foreignKey({ name: "stock_transactions_part_fk", columns: [t.companyId, t.partId], foreignColumns: [inventory.companyId, inventory.id] }),
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").notNull(),
  vendor: text("vendor").notNull(),
  status: text("status").notNull().default("Draft"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  requestedBy: text("requested_by"),
  date: text("date"),
  items: integer("items").notNull().default(0),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "purchase_orders_pkey" }),
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
  rating: () => numericInput.nullable().optional(),
  leadTimeDays: (s) => s.int().min(0).nullable().optional(),
  email: () => z.string().trim().toLowerCase().email().max(320).nullable().optional().or(z.literal("")),
}).omit({ companyId: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ companyId: true, createdAt: true, completedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ companyId: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ companyId: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders, {
  total: () => numericInput.optional(),
}).omit({ companyId: true });
export const insertAssetAuditSchema = createInsertSchema(assetAudits).omit({ companyId: true });
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({ companyId: true });

// Update schemas: every column optional, primary keys can never be changed.
export const updateUserSchema = insertUserSchema.partial();
export const updateSiteSchema = insertSiteSchema.omit({ id: true }).partial();
export const updateLocationSchema = insertLocationSchema.omit({ id: true }).partial();
export const updateStoreRoomSchema = insertStoreRoomSchema.omit({ id: true }).partial();
export const updateBinSchema = insertBinSchema.omit({ id: true }).partial();
export const updateAssetSchema = insertAssetSchema.omit({ id: true }).partial();
export const updateInventorySchema = insertInventorySchema.omit({ id: true }).partial();
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
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type AssetAudit = typeof assetAudits.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
