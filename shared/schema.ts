import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp, boolean, jsonb, primaryKey, foreignKey, unique, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Multi-company model: every business record carries company_id, and record codes
 * (SITE-001, JOB-1001, ...) are unique per company via composite primary keys.
 * Composite foreign keys make it impossible to link records across companies.
 */
export const COMPANY_STATUSES = ["Active", "Suspended"] as const;

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
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "sites_pkey" }),
]);

export const locations = pgTable("locations", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  siteId: text("site_id").notNull(),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "locations_pkey" }),
  foreignKey({ name: "locations_site_fk", columns: [t.companyId, t.siteId], foreignColumns: [sites.companyId, sites.id] }),
]);

export const assets = pgTable("assets", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  locationId: text("location_id"),
  status: text("status").notNull().default("Operational"),
  health: integer("health").notNull().default(100),
  lastService: text("last_service"),
  image: text("image"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "assets_pkey" }),
  foreignKey({ name: "assets_location_fk", columns: [t.companyId, t.locationId], foreignColumns: [locations.companyId, locations.id] }),
]);

export const assetParts = pgTable("asset_parts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assetId: text("asset_id").notNull(),
  partId: text("part_id").notNull(),
  companyId: companyId(),
}, (t) => [
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
  location: text("location"),
  lastUsed: text("last_used"),
  lastStockTaken: text("last_stock_taken"),
  lastReplenished: text("last_replenished"),
  leadTime: integer("lead_time").default(1),
  primarySupplierId: text("primary_supplier_id"),
  secondarySupplierId: text("secondary_supplier_id"),
  companyId: companyId(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.id], name: "inventory_pkey" }),
]);

export const suppliers = pgTable("suppliers", {
  id: text("id").notNull(),
  name: text("name").notNull(),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  leadTime: text("lead_time"),
  contact: text("contact"),
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
export const insertLocationSchema = createInsertSchema(locations).omit({ companyId: true });
export const insertAssetSchema = createInsertSchema(assets, {
  health: (s) => s.int().min(0).max(100),
}).omit({ companyId: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ companyId: true });
export const insertSupplierSchema = createInsertSchema(suppliers, {
  rating: () => numericInput.nullable().optional(),
}).omit({ companyId: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ companyId: true });
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
export const updateAssetSchema = insertAssetSchema.omit({ id: true }).partial();
export const updateInventorySchema = insertInventorySchema.omit({ id: true }).partial();
export const updateSupplierSchema = insertSupplierSchema.omit({ id: true }).partial();
export const updateJobSchema = insertJobSchema.omit({ id: true }).partial();
export const updateTemplateSchema = insertTemplateSchema.omit({ id: true }).partial();
export const updatePurchaseOrderSchema = insertPurchaseOrderSchema.omit({ id: true }).partial();
export const updateAssetAuditSchema = insertAssetAuditSchema.omit({ id: true }).partial();
export const updateMaintenanceRequestSchema = insertMaintenanceRequestSchema.omit({ id: true }).partial();

export const assetPartsInputSchema = z.array(z.string().min(1)).max(500);

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
export type Asset = typeof assets.$inferSelect;
export type InventoryItem = typeof inventory.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type AssetAudit = typeof assetAudits.$inferSelect;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
