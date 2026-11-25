import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { hashPassword } from "./password";
import {
  users, sites, locations, assets, assetParts, inventory,
  suppliers, jobs, templates, stockTransactions, purchaseOrders,
  assetAudits, maintenanceRequests,
  type InsertUser, type User, type PublicUser,
  type InsertSite, type InsertLocation, type InsertAsset, type InsertInventoryItem,
  type InsertSupplier, type InsertJob, type InsertTemplate, type InsertStockTransaction,
  type InsertPurchaseOrder, type InsertAssetAudit, type InsertMaintenanceRequest, type Site, type Location, type Asset,
  type InventoryItem, type Supplier, type Job, type Template,
  type StockTransaction, type PurchaseOrder, type AssetAudit, type MaintenanceRequest
} from "@shared/schema";

export interface IStorage {
  getUsers(): Promise<PublicUser[]>;
  getUser(id: number): Promise<PublicUser | undefined>;
  /** Internal use only (authentication): includes the password hash. */
  getUserCredentialsByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<PublicUser>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<PublicUser | undefined>;

  getSites(): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<void>;

  getLocations(): Promise<Location[]>;
  createLocation(loc: InsertLocation): Promise<Location>;
  updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<void>;

  getAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<void>;
  getAssetParts(assetId: string): Promise<string[]>;
  setAssetParts(assetId: string, partIds: string[]): Promise<void>;

  getInventory(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<void>;

  getSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<void>;

  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;

  getTemplates(): Promise<Template[]>;
  createTemplate(tpl: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<void>;

  getStockTransactions(): Promise<StockTransaction[]>;
  createStockTransaction(txn: InsertStockTransaction): Promise<StockTransaction>;

  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;

  getAssetAudits(): Promise<AssetAudit[]>;
  createAssetAudit(audit: InsertAssetAudit): Promise<AssetAudit>;
  updateAssetAudit(id: string, data: Partial<InsertAssetAudit>): Promise<AssetAudit | undefined>;

  getMaintenanceRequests(): Promise<MaintenanceRequest[]>;
  createMaintenanceRequest(req: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  updateMaintenanceRequest(id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined>;
}

// Explicit projection so the password hash can never leak through a user query.
const publicUserColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  status: users.status,
  avatar: users.avatar,
  email: users.email,
};

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<PublicUser[]> {
    return db.select(publicUserColumns).from(users);
  }
  async getUser(id: number): Promise<PublicUser | undefined> {
    const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, id));
    return user;
  }
  async getUserCredentialsByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
    return user;
  }
  async createUser(data: InsertUser): Promise<PublicUser> {
    const values = { ...data, password: data.password ? await hashPassword(data.password) : null };
    const [user] = await db.insert(users).values(values).returning(publicUserColumns);
    return user;
  }
  async updateUser(id: number, data: Partial<InsertUser>): Promise<PublicUser | undefined> {
    const values = { ...data };
    if (values.password) values.password = await hashPassword(values.password);
    const [user] = await db.update(users).set(values).where(eq(users.id, id)).returning(publicUserColumns);
    return user;
  }

  async getSites(): Promise<Site[]> {
    return db.select().from(sites);
  }
  async createSite(site: InsertSite): Promise<Site> {
    const [s] = await db.insert(sites).values(site).returning();
    return s;
  }
  async updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [s] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return s;
  }
  async deleteSite(id: string): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  async getLocations(): Promise<Location[]> {
    return db.select().from(locations);
  }
  async createLocation(loc: InsertLocation): Promise<Location> {
    const [l] = await db.insert(locations).values(loc).returning();
    return l;
  }
  async updateLocation(id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [l] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
    return l;
  }
  async deleteLocation(id: string): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  async getAssets(): Promise<Asset[]> {
    return db.select().from(assets);
  }
  async getAsset(id: string): Promise<Asset | undefined> {
    const [a] = await db.select().from(assets).where(eq(assets.id, id));
    return a;
  }
  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [a] = await db.insert(assets).values(asset).returning();
    return a;
  }
  async updateAsset(id: string, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [a] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return a;
  }
  async deleteAsset(id: string): Promise<void> {
    await db.delete(assetParts).where(eq(assetParts.assetId, id));
    await db.delete(assets).where(eq(assets.id, id));
  }
  async getAssetParts(assetId: string): Promise<string[]> {
    const rows = await db.select().from(assetParts).where(eq(assetParts.assetId, assetId));
    return rows.map(r => r.partId);
  }
  async setAssetParts(assetId: string, partIds: string[]): Promise<void> {
    await db.delete(assetParts).where(eq(assetParts.assetId, assetId));
    if (partIds.length > 0) {
      await db.insert(assetParts).values(partIds.map(partId => ({ assetId, partId })));
    }
  }

  async getInventory(): Promise<InventoryItem[]> {
    return db.select().from(inventory);
  }
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    return item;
  }
  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [i] = await db.insert(inventory).values(item).returning();
    return i;
  }
  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [i] = await db.update(inventory).set(data).where(eq(inventory.id, id)).returning();
    return i;
  }
  async deleteInventoryItem(id: string): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  }

  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers);
  }
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [s] = await db.insert(suppliers).values(supplier).returning();
    return s;
  }
  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [s] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return s;
  }
  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async getJobs(): Promise<Job[]> {
    return db.select().from(jobs);
  }
  async getJob(id: string): Promise<Job | undefined> {
    const [j] = await db.select().from(jobs).where(eq(jobs.id, id));
    return j;
  }
  async createJob(job: InsertJob): Promise<Job> {
    const [j] = await db.insert(jobs).values(job).returning();
    return j;
  }
  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [j] = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();
    return j;
  }
  async deleteJob(id: string): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async getTemplates(): Promise<Template[]> {
    return db.select().from(templates);
  }
  async createTemplate(tpl: InsertTemplate): Promise<Template> {
    const [t] = await db.insert(templates).values(tpl).returning();
    return t;
  }
  async updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [t] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
    return t;
  }
  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  async getStockTransactions(): Promise<StockTransaction[]> {
    return db.select().from(stockTransactions);
  }
  async createStockTransaction(txn: InsertStockTransaction): Promise<StockTransaction> {
    const [t] = await db.insert(stockTransactions).values(txn).returning();
    return t;
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders);
  }
  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [p] = await db.insert(purchaseOrders).values(po).returning();
    return p;
  }
  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [p] = await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id)).returning();
    return p;
  }

  async getAssetAudits(): Promise<AssetAudit[]> {
    return db.select().from(assetAudits);
  }
  async createAssetAudit(audit: InsertAssetAudit): Promise<AssetAudit> {
    const [a] = await db.insert(assetAudits).values(audit).returning();
    return a;
  }
  async updateAssetAudit(id: string, data: Partial<InsertAssetAudit>): Promise<AssetAudit | undefined> {
    const [a] = await db.update(assetAudits).set(data).where(eq(assetAudits.id, id)).returning();
    return a;
  }

  async getMaintenanceRequests(): Promise<MaintenanceRequest[]> {
    return db.select().from(maintenanceRequests);
  }
  async createMaintenanceRequest(req: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    const [r] = await db.insert(maintenanceRequests).values(req).returning();
    return r;
  }
  async updateMaintenanceRequest(id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined> {
    const [r] = await db.update(maintenanceRequests).set(data).where(eq(maintenanceRequests.id, id)).returning();
    return r;
  }
}

export const storage = new DatabaseStorage();
