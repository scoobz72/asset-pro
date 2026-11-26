import { and, eq, sql, count, desc } from "drizzle-orm";
import { db } from "./db";
import { hashPassword } from "./password";
import {
  companies, accessRequests,
  users, sites, locations, assets, assetParts, inventory,
  suppliers, jobs, templates, stockTransactions, purchaseOrders,
  assetAudits, maintenanceRequests,
  type InsertUser, type User, type PublicUser, type Company, type AccessRequest,
  type InsertSite, type InsertLocation, type InsertAsset, type InsertInventoryItem,
  type InsertSupplier, type InsertJob, type InsertTemplate, type InsertStockTransaction,
  type InsertPurchaseOrder, type InsertAssetAudit, type InsertMaintenanceRequest, type Site, type Location, type Asset,
  type InventoryItem, type Supplier, type Job, type Template,
  type StockTransaction, type PurchaseOrder, type AssetAudit, type MaintenanceRequest
} from "@shared/schema";

export interface IStorage {
  getUsers(companyId: number): Promise<PublicUser[]>;
  getUser(id: number): Promise<PublicUser | undefined>;
  /** Internal use only (authentication): includes the password hash. */
  getUserCredentialsByEmail(email: string): Promise<User | undefined>;
  createUser(companyId: number, user: InsertUser): Promise<PublicUser>;
  updateUser(companyId: number, id: number, data: Partial<InsertUser>): Promise<PublicUser | undefined>;

  getSites(companyId: number): Promise<Site[]>;
  createSite(companyId: number, site: InsertSite): Promise<Site>;
  updateSite(companyId: number, id: string, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(companyId: number, id: string): Promise<void>;

  getLocations(companyId: number): Promise<Location[]>;
  createLocation(companyId: number, loc: InsertLocation): Promise<Location>;
  updateLocation(companyId: number, id: string, data: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(companyId: number, id: string): Promise<void>;

  getAssets(companyId: number): Promise<Asset[]>;
  getAsset(companyId: number, id: string): Promise<Asset | undefined>;
  createAsset(companyId: number, asset: InsertAsset): Promise<Asset>;
  updateAsset(companyId: number, id: string, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(companyId: number, id: string): Promise<void>;
  getAssetParts(companyId: number, assetId: string): Promise<string[]>;
  setAssetParts(companyId: number, assetId: string, partIds: string[]): Promise<void>;

  getInventory(companyId: number): Promise<InventoryItem[]>;
  getInventoryItem(companyId: number, id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(companyId: number, item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(companyId: number, id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(companyId: number, id: string): Promise<void>;

  getSuppliers(companyId: number): Promise<Supplier[]>;
  createSupplier(companyId: number, supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(companyId: number, id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(companyId: number, id: string): Promise<void>;

  getJobs(companyId: number): Promise<Job[]>;
  getJob(companyId: number, id: string): Promise<Job | undefined>;
  createJob(companyId: number, job: InsertJob): Promise<Job>;
  updateJob(companyId: number, id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(companyId: number, id: string): Promise<void>;

  getTemplates(companyId: number): Promise<Template[]>;
  createTemplate(companyId: number, tpl: InsertTemplate): Promise<Template>;
  updateTemplate(companyId: number, id: string, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(companyId: number, id: string): Promise<void>;

  getStockTransactions(companyId: number): Promise<StockTransaction[]>;
  createStockTransaction(companyId: number, txn: InsertStockTransaction): Promise<StockTransaction>;

  getPurchaseOrders(companyId: number): Promise<PurchaseOrder[]>;
  createPurchaseOrder(companyId: number, po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(companyId: number, id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;

  getAssetAudits(companyId: number): Promise<AssetAudit[]>;
  createAssetAudit(companyId: number, audit: InsertAssetAudit): Promise<AssetAudit>;
  updateAssetAudit(companyId: number, id: string, data: Partial<InsertAssetAudit>): Promise<AssetAudit | undefined>;

  getMaintenanceRequests(companyId: number): Promise<MaintenanceRequest[]>;
  createMaintenanceRequest(companyId: number, req: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  updateMaintenanceRequest(companyId: number, id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined>;

  // Platform administration (not company-scoped)
  getCompany(id: number): Promise<Company | undefined>;
  listCompanies(): Promise<(Company & { userCount: number })[]>;
  createCompanyWithManager(input: { name: string; managerName: string; managerEmail: string; managerPassword: string }): Promise<{ company: Company; manager: PublicUser }>;
  updateCompany(id: number, data: Partial<Pick<Company, "name" | "status">>): Promise<Company | undefined>;
  listAccessRequests(): Promise<AccessRequest[]>;
  createAccessRequest(data: { name: string; company: string; email: string; phone?: string | null; message?: string | null }): Promise<AccessRequest>;
  updateAccessRequest(id: number, status: string): Promise<AccessRequest | undefined>;
}

// Explicit projection so the password hash can never leak through a user query.
const publicUserColumns = {
  id: users.id,
  name: users.name,
  role: users.role,
  status: users.status,
  avatar: users.avatar,
  email: users.email,
  companyId: users.companyId,
};

export class DatabaseStorage implements IStorage {
  async getUsers(companyId: number): Promise<PublicUser[]> {
    return db.select(publicUserColumns).from(users).where(eq(users.companyId, companyId));
  }
  /** Not company-scoped: used to load the signed-in user from the session. */
  async getUser(id: number): Promise<PublicUser | undefined> {
    const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, id));
    return user;
  }
  async getUserCredentialsByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase()));
    return user;
  }
  async createUser(companyId: number, data: InsertUser): Promise<PublicUser> {
    const values = { ...data, companyId, password: data.password ? await hashPassword(data.password) : null };
    const [user] = await db.insert(users).values(values).returning(publicUserColumns);
    return user;
  }
  async updateUser(companyId: number, id: number, data: Partial<InsertUser>): Promise<PublicUser | undefined> {
    const values = { ...data };
    if (values.password) values.password = await hashPassword(values.password);
    const [user] = await db.update(users).set(values)
      .where(and(eq(users.companyId, companyId), eq(users.id, id))).returning(publicUserColumns);
    return user;
  }

  async getSites(companyId: number): Promise<Site[]> {
    return db.select().from(sites).where(eq(sites.companyId, companyId));
  }
  async createSite(companyId: number, site: InsertSite): Promise<Site> {
    const [s] = await db.insert(sites).values({ ...site, companyId }).returning();
    return s;
  }
  async updateSite(companyId: number, id: string, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [s] = await db.update(sites).set(data).where(and(eq(sites.companyId, companyId), eq(sites.id, id))).returning();
    return s;
  }
  async deleteSite(companyId: number, id: string): Promise<void> {
    await db.delete(sites).where(and(eq(sites.companyId, companyId), eq(sites.id, id)));
  }

  async getLocations(companyId: number): Promise<Location[]> {
    return db.select().from(locations).where(eq(locations.companyId, companyId));
  }
  async createLocation(companyId: number, loc: InsertLocation): Promise<Location> {
    const [l] = await db.insert(locations).values({ ...loc, companyId }).returning();
    return l;
  }
  async updateLocation(companyId: number, id: string, data: Partial<InsertLocation>): Promise<Location | undefined> {
    const [l] = await db.update(locations).set(data).where(and(eq(locations.companyId, companyId), eq(locations.id, id))).returning();
    return l;
  }
  async deleteLocation(companyId: number, id: string): Promise<void> {
    await db.delete(locations).where(and(eq(locations.companyId, companyId), eq(locations.id, id)));
  }

  async getAssets(companyId: number): Promise<Asset[]> {
    return db.select().from(assets).where(eq(assets.companyId, companyId));
  }
  async getAsset(companyId: number, id: string): Promise<Asset | undefined> {
    const [a] = await db.select().from(assets).where(and(eq(assets.companyId, companyId), eq(assets.id, id)));
    return a;
  }
  async createAsset(companyId: number, asset: InsertAsset): Promise<Asset> {
    const [a] = await db.insert(assets).values({ ...asset, companyId }).returning();
    return a;
  }
  async updateAsset(companyId: number, id: string, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [a] = await db.update(assets).set(data).where(and(eq(assets.companyId, companyId), eq(assets.id, id))).returning();
    return a;
  }
  async deleteAsset(companyId: number, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(assetParts).where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, id)));
      await tx.delete(assets).where(and(eq(assets.companyId, companyId), eq(assets.id, id)));
    });
  }
  async getAssetParts(companyId: number, assetId: string): Promise<string[]> {
    const rows = await db.select().from(assetParts)
      .where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, assetId)));
    return rows.map(r => r.partId);
  }
  async setAssetParts(companyId: number, assetId: string, partIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(assetParts).where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, assetId)));
      if (partIds.length > 0) {
        await tx.insert(assetParts).values(partIds.map(partId => ({ companyId, assetId, partId })));
      }
    });
  }

  async getInventory(companyId: number): Promise<InventoryItem[]> {
    return db.select().from(inventory).where(eq(inventory.companyId, companyId));
  }
  async getInventoryItem(companyId: number, id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventory).where(and(eq(inventory.companyId, companyId), eq(inventory.id, id)));
    return item;
  }
  async createInventoryItem(companyId: number, item: InsertInventoryItem): Promise<InventoryItem> {
    const [i] = await db.insert(inventory).values({ ...item, companyId }).returning();
    return i;
  }
  async updateInventoryItem(companyId: number, id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [i] = await db.update(inventory).set(data).where(and(eq(inventory.companyId, companyId), eq(inventory.id, id))).returning();
    return i;
  }
  async deleteInventoryItem(companyId: number, id: string): Promise<void> {
    await db.delete(inventory).where(and(eq(inventory.companyId, companyId), eq(inventory.id, id)));
  }

  async getSuppliers(companyId: number): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.companyId, companyId));
  }
  async createSupplier(companyId: number, supplier: InsertSupplier): Promise<Supplier> {
    const [s] = await db.insert(suppliers).values({ ...supplier, companyId }).returning();
    return s;
  }
  async updateSupplier(companyId: number, id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [s] = await db.update(suppliers).set(data).where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, id))).returning();
    return s;
  }
  async deleteSupplier(companyId: number, id: string): Promise<void> {
    await db.delete(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, id)));
  }

  async getJobs(companyId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.companyId, companyId));
  }
  async getJob(companyId: number, id: string): Promise<Job | undefined> {
    const [j] = await db.select().from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, id)));
    return j;
  }
  async createJob(companyId: number, job: InsertJob): Promise<Job> {
    const [j] = await db.insert(jobs).values({ ...job, companyId }).returning();
    return j;
  }
  async updateJob(companyId: number, id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [j] = await db.update(jobs).set(data).where(and(eq(jobs.companyId, companyId), eq(jobs.id, id))).returning();
    return j;
  }
  async deleteJob(companyId: number, id: string): Promise<void> {
    await db.delete(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, id)));
  }

  async getTemplates(companyId: number): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.companyId, companyId));
  }
  async createTemplate(companyId: number, tpl: InsertTemplate): Promise<Template> {
    const [t] = await db.insert(templates).values({ ...tpl, companyId }).returning();
    return t;
  }
  async updateTemplate(companyId: number, id: string, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [t] = await db.update(templates).set(data).where(and(eq(templates.companyId, companyId), eq(templates.id, id))).returning();
    return t;
  }
  async deleteTemplate(companyId: number, id: string): Promise<void> {
    await db.delete(templates).where(and(eq(templates.companyId, companyId), eq(templates.id, id)));
  }

  async getStockTransactions(companyId: number): Promise<StockTransaction[]> {
    return db.select().from(stockTransactions).where(eq(stockTransactions.companyId, companyId));
  }
  async createStockTransaction(companyId: number, txn: InsertStockTransaction): Promise<StockTransaction> {
    const [t] = await db.insert(stockTransactions).values({ ...txn, companyId }).returning();
    return t;
  }

  async getPurchaseOrders(companyId: number): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
  }
  async createPurchaseOrder(companyId: number, po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [p] = await db.insert(purchaseOrders).values({ ...po, companyId }).returning();
    return p;
  }
  async updatePurchaseOrder(companyId: number, id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [p] = await db.update(purchaseOrders).set(data).where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id))).returning();
    return p;
  }

  async getAssetAudits(companyId: number): Promise<AssetAudit[]> {
    return db.select().from(assetAudits).where(eq(assetAudits.companyId, companyId));
  }
  async createAssetAudit(companyId: number, audit: InsertAssetAudit): Promise<AssetAudit> {
    const [a] = await db.insert(assetAudits).values({ ...audit, companyId }).returning();
    return a;
  }
  async updateAssetAudit(companyId: number, id: string, data: Partial<InsertAssetAudit>): Promise<AssetAudit | undefined> {
    const [a] = await db.update(assetAudits).set(data).where(and(eq(assetAudits.companyId, companyId), eq(assetAudits.id, id))).returning();
    return a;
  }

  async getMaintenanceRequests(companyId: number): Promise<MaintenanceRequest[]> {
    return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.companyId, companyId));
  }
  async createMaintenanceRequest(companyId: number, req: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    const [r] = await db.insert(maintenanceRequests).values({ ...req, companyId }).returning();
    return r;
  }
  async updateMaintenanceRequest(companyId: number, id: string, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined> {
    const [r] = await db.update(maintenanceRequests).set(data).where(and(eq(maintenanceRequests.companyId, companyId), eq(maintenanceRequests.id, id))).returning();
    return r;
  }

  // ===== PLATFORM ADMINISTRATION =====
  async getCompany(id: number): Promise<Company | undefined> {
    const [c] = await db.select().from(companies).where(eq(companies.id, id));
    return c;
  }
  async listCompanies(): Promise<(Company & { userCount: number })[]> {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        status: companies.status,
        createdAt: companies.createdAt,
        userCount: count(users.id),
      })
      .from(companies)
      .leftJoin(users, eq(users.companyId, companies.id))
      .groupBy(companies.id)
      .orderBy(companies.name);
    return rows.map((r) => ({ ...r, userCount: Number(r.userCount) }));
  }
  async createCompanyWithManager(input: { name: string; managerName: string; managerEmail: string; managerPassword: string }) {
    const passwordHash = await hashPassword(input.managerPassword);
    return db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({ name: input.name }).returning();
      const [manager] = await tx.insert(users).values({
        companyId: company.id,
        name: input.managerName,
        email: input.managerEmail.toLowerCase(),
        role: "Manager",
        status: "Available",
        password: passwordHash,
      }).returning(publicUserColumns);
      return { company, manager };
    });
  }
  async updateCompany(id: number, data: Partial<Pick<Company, "name" | "status">>): Promise<Company | undefined> {
    const [c] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return c;
  }
  async listAccessRequests(): Promise<AccessRequest[]> {
    return db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt));
  }
  async createAccessRequest(data: { name: string; company: string; email: string; phone?: string | null; message?: string | null }): Promise<AccessRequest> {
    const [r] = await db.insert(accessRequests).values({
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone || null,
      message: data.message || null,
    }).returning();
    return r;
  }
  async updateAccessRequest(id: number, status: string): Promise<AccessRequest | undefined> {
    const [r] = await db.update(accessRequests).set({ status }).where(eq(accessRequests.id, id)).returning();
    return r;
  }
}

export const storage = new DatabaseStorage();
