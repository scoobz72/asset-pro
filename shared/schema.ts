import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Technician"),
  status: text("status").notNull().default("Available"),
  avatar: text("avatar"),
  email: text("email"),
  password: text("password"),
});

export const sites = pgTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  siteId: text("site_id").notNull().references(() => sites.id),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  locationId: text("location_id").references(() => locations.id),
  status: text("status").notNull().default("Operational"),
  health: integer("health").notNull().default(100),
  lastService: text("last_service"),
  image: text("image"),
});

export const assetParts = pgTable("asset_parts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assetId: text("asset_id").notNull().references(() => assets.id),
  partId: text("part_id").notNull().references(() => inventory.id),
});

export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
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
});

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  leadTime: text("lead_time"),
  contact: text("contact"),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  assetId: text("asset_id").references(() => assets.id),
  priority: text("priority").notNull().default("Medium"),
  status: text("status").notNull().default("Open"),
  assigneeId: integer("assignee_id").references(() => users.id),
  dueDate: text("due_date"),
  templateId: text("template_id"),
  type: text("type").default("Breakdown"),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Planned"),
  description: text("description"),
  steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`),
  signOffs: text("sign_offs").array().notNull().default(sql`'{}'::text[]`),
});

export const stockTransactions = pgTable("stock_transactions", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  partId: text("part_id").notNull().references(() => inventory.id),
  partName: text("part_name"),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  userId: text("user_id"),
  reference: text("reference"),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  vendor: text("vendor").notNull(),
  status: text("status").notNull().default("Draft"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  requestedBy: text("requested_by"),
  date: text("date"),
  items: integer("items").notNull().default(0),
});

export const assetAudits = pgTable("asset_audits", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id),
  status: text("status").notNull().default("Pending"),
  scheduledDate: text("scheduled_date"),
  assignedTo: text("assigned_to"),
  expectedLocation: text("expected_location"),
  verifiedLocation: text("verified_location"),
  completionDate: text("completion_date"),
  notes: text("notes"),
});

export const maintenanceRequests = pgTable("maintenance_requests", {
  id: text("id").primaryKey(),
  requestedBy: text("requested_by").notNull(),
  title: text("title").notNull(),
  assetId: text("asset_id"),
  area: text("area"),
  urgency: text("urgency").notNull().default("Medium"),
  description: text("description"),
  status: text("status").notNull().default("Submitted"),
  createdAt: text("created_at"),
});

// Generated identity columns are already excluded by drizzle-zod.
export const insertUserSchema = createInsertSchema(users);
export const insertSiteSchema = createInsertSchema(sites);
export const insertLocationSchema = createInsertSchema(locations);
export const insertAssetSchema = createInsertSchema(assets);
export const insertInventorySchema = createInsertSchema(inventory);
export const insertSupplierSchema = createInsertSchema(suppliers);
export const insertJobSchema = createInsertSchema(jobs);
export const insertTemplateSchema = createInsertSchema(templates);
export const insertStockTransactionSchema = createInsertSchema(stockTransactions);
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders);
export const insertAssetAuditSchema = createInsertSchema(assetAudits);
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
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
