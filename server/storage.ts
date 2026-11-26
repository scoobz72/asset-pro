import { and, eq, sql, count, desc } from "drizzle-orm";
import { db } from "./db";
import { recordMovement, type Actor } from "./stock/ledger";
import { hashPassword } from "./password";
import {
  companies, accessRequests,
  users, sites, locations, storeRooms, bins, assets, assetParts, inventory,
  suppliers, jobs, templates, stockTransactions, purchaseOrders,
  assetAudits, maintenanceRequests,
  type InsertUser, type User, type PublicUser, type Company, type AccessRequest,
  type InsertSite, type InsertLocation, type InsertStoreRoom, type InsertBin, type StoreRoom, type Bin, type AssetPartInput, type InsertAsset, type InsertInventoryItem,
  type InsertSupplier, type InsertJob, type InsertTemplate, type InsertStockTransaction,
  type InsertPurchaseOrder, type InsertAssetAudit, type InsertMaintenanceRequest, type Site, type Location, type Asset,
  type InventoryItem, type Supplier, type Job, type Template,
  type StockTransaction, type PurchaseOrder, type AssetAudit, type MaintenanceRequest
} from "@shared/schema";

/** Figures for the dashboard and reports, computed in SQL for one company. */
export interface DashboardSummary {
  openJobs: number;
  openedThisWeek: number;
  openedLastWeek: number;
  completedThisWeek: number;
  completedLastWeek: number;
  assetsDown: number;
  assetsTotal: number;
  lowStock: number;
  /** Last 7 days, oldest first, as YYYY-MM-DD (Europe/London). */
  daily: { day: string; opened: number; completed: number }[];
  /** Median days between breakdowns across assets with 2+ breakdowns; null if none qualify. */
  mtbfDays: number | null;
  /** Mean hours from creation to completion of breakdowns completed in the last 90 days. */
  mttrHours: number | null;
  stockValueByCategory: { category: string; value: number; uncosted: number }[];
  topBreakdownAssets: { assetId: string; name: string; breakdowns: number }[];
}

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

  getStoreRooms(companyId: number): Promise<StoreRoom[]>;
  createStoreRoom(companyId: number, room: InsertStoreRoom): Promise<StoreRoom>;
  updateStoreRoom(companyId: number, id: string, data: Partial<InsertStoreRoom>): Promise<StoreRoom | undefined>;
  deleteStoreRoom(companyId: number, id: string): Promise<void>;

  getBins(companyId: number): Promise<Bin[]>;
  createBin(companyId: number, bin: InsertBin): Promise<Bin>;
  updateBin(companyId: number, id: string, data: Partial<InsertBin>): Promise<Bin | undefined>;
  deleteBin(companyId: number, id: string): Promise<void>;

  getAssets(companyId: number): Promise<Asset[]>;
  getAsset(companyId: number, id: string): Promise<Asset | undefined>;
  createAsset(companyId: number, asset: InsertAsset): Promise<Asset>;
  updateAsset(companyId: number, id: string, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(companyId: number, id: string): Promise<void>;
  getAssetParts(companyId: number, assetId: string): Promise<AssetPartInput[]>;
  /** Every asset/part link in the company, for "used on assets" lookups. */
  getAllAssetParts(companyId: number): Promise<{ assetId: string; partId: string; quantity: number }[]>;
  setAssetParts(companyId: number, assetId: string, parts: AssetPartInput[]): Promise<void>;

  getInventory(companyId: number): Promise<InventoryItem[]>;
  getInventoryItem(companyId: number, id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(companyId: number, item: InsertInventoryItem, actor?: Actor): Promise<InventoryItem>;
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

  getDashboardSummary(companyId: number): Promise<DashboardSummary>;

  getStockTransactions(companyId: number): Promise<StockTransaction[]>;

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
  poApprovalLimit: users.poApprovalLimit,
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

  async getStoreRooms(companyId: number): Promise<StoreRoom[]> {
    return db.select().from(storeRooms).where(eq(storeRooms.companyId, companyId));
  }
  async createStoreRoom(companyId: number, room: InsertStoreRoom): Promise<StoreRoom> {
    const [r] = await db.insert(storeRooms).values({ ...room, companyId }).returning();
    return r;
  }
  async updateStoreRoom(companyId: number, id: string, data: Partial<InsertStoreRoom>): Promise<StoreRoom | undefined> {
    const [r] = await db.update(storeRooms).set(data).where(and(eq(storeRooms.companyId, companyId), eq(storeRooms.id, id))).returning();
    return r;
  }
  async deleteStoreRoom(companyId: number, id: string): Promise<void> {
    await db.delete(storeRooms).where(and(eq(storeRooms.companyId, companyId), eq(storeRooms.id, id)));
  }

  async getBins(companyId: number): Promise<Bin[]> {
    return db.select().from(bins).where(eq(bins.companyId, companyId));
  }
  async createBin(companyId: number, bin: InsertBin): Promise<Bin> {
    const [b] = await db.insert(bins).values({ ...bin, companyId }).returning();
    return b;
  }
  async updateBin(companyId: number, id: string, data: Partial<InsertBin>): Promise<Bin | undefined> {
    const [b] = await db.update(bins).set(data).where(and(eq(bins.companyId, companyId), eq(bins.id, id))).returning();
    return b;
  }
  async deleteBin(companyId: number, id: string): Promise<void> {
    await db.delete(bins).where(and(eq(bins.companyId, companyId), eq(bins.id, id)));
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
  async getAssetParts(companyId: number, assetId: string): Promise<AssetPartInput[]> {
    return db.select({ partId: assetParts.partId, quantity: assetParts.quantity }).from(assetParts)
      .where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, assetId)));
  }
  async getAllAssetParts(companyId: number): Promise<{ assetId: string; partId: string; quantity: number }[]> {
    return db.select({ assetId: assetParts.assetId, partId: assetParts.partId, quantity: assetParts.quantity })
      .from(assetParts).where(eq(assetParts.companyId, companyId));
  }
  async setAssetParts(companyId: number, assetId: string, parts: AssetPartInput[]): Promise<void> {
    // The same part listed twice is merged, so the unique (asset, part) key can't be hit.
    const merged = new Map<string, number>();
    for (const p of parts) merged.set(p.partId, (merged.get(p.partId) ?? 0) + p.quantity);
    await db.transaction(async (tx) => {
      await tx.delete(assetParts).where(and(eq(assetParts.companyId, companyId), eq(assetParts.assetId, assetId)));
      if (merged.size > 0) {
        await tx.insert(assetParts).values(
          Array.from(merged, ([partId, quantity]) => ({ companyId, assetId, partId, quantity })),
        );
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
  async createInventoryItem(companyId: number, item: InsertInventoryItem, actor: Actor = { name: "System" }): Promise<InventoryItem> {
    // Opening stock goes through the ledger, so the part gets its first FIFO lot.
    return db.transaction(async (tx) => {
      const { stock, lastUsed: _u, lastStockTaken: _t, lastReplenished: _r, ...rest } = item;
      const [created] = await tx.insert(inventory).values({ ...rest, stock: 0, companyId }).returning();
      if (stock && stock > 0) {
        await recordMovement(tx, companyId, { partId: created.id, type: "Stock In", quantity: stock, reference: "Opening stock" }, actor);
        const [withStock] = await tx.select().from(inventory).where(and(eq(inventory.companyId, companyId), eq(inventory.id, created.id)));
        return withStock;
      }
      return created;
    });
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
    const completedAt = job.status === "Completed" ? new Date() : null;
    const [j] = await db.insert(jobs).values({ ...job, companyId, completedAt }).returning();
    return j;
  }
  async updateJob(companyId: number, id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    // completed_at follows the status: stamped when a job becomes Completed (keeping the
    // original time if it already was), cleared when it is reopened. Done in one UPDATE
    // so it can't race with another edit.
    const completedAt = data.status === undefined
      ? undefined
      : data.status === "Completed"
        ? sql`coalesce(${jobs.completedAt}, now())`
        : sql`null`;
    const [j] = await db.update(jobs)
      .set(completedAt === undefined ? data : { ...data, completedAt })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, id))).returning();
    return j;
  }
  async deleteJob(companyId: number, id: string): Promise<void> {
    await db.delete(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, id)));
  }

  async getDashboardSummary(companyId: number): Promise<DashboardSummary> {
    const num = (v: unknown) => Number(v ?? 0);

    const [jobCounts] = (await db.execute(sql`
      select
        count(*) filter (where ${jobs.status} <> 'Completed') as open_jobs,
        count(*) filter (where ${jobs.createdAt} >= now() - interval '7 days') as opened_this,
        count(*) filter (where ${jobs.createdAt} >= now() - interval '14 days' and ${jobs.createdAt} < now() - interval '7 days') as opened_last,
        count(*) filter (where ${jobs.completedAt} >= now() - interval '7 days') as completed_this,
        count(*) filter (where ${jobs.completedAt} >= now() - interval '14 days' and ${jobs.completedAt} < now() - interval '7 days') as completed_last
      from ${jobs} where ${jobs.companyId} = ${companyId}
    `)).rows as any[];

    const [assetCounts] = (await db.execute(sql`
      select count(*) filter (where ${assets.status} in ('Down', 'Maintenance')) as down, count(*) as total
      from ${assets} where ${assets.companyId} = ${companyId}
    `)).rows as any[];

    const [stockCounts] = (await db.execute(sql`
      select count(*) filter (where ${inventory.stock} < ${inventory.minStock}) as low
      from ${inventory} where ${inventory.companyId} = ${companyId}
    `)).rows as any[];

    const daily = (await db.execute(sql`
      with days as (
        select generate_series((now() at time zone 'Europe/London')::date - 6, (now() at time zone 'Europe/London')::date, interval '1 day')::date as day
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
        (select count(*) from ${jobs} where ${jobs.companyId} = ${companyId} and (${jobs.createdAt} at time zone 'Europe/London')::date = d.day) as opened,
        (select count(*) from ${jobs} where ${jobs.companyId} = ${companyId} and (${jobs.completedAt} at time zone 'Europe/London')::date = d.day) as completed
      from days d order by d.day
    `)).rows as any[];

    const [mtbf] = (await db.execute(sql`
      select percentile_cont(0.5) within group (order by gap_days) as median_days from (
        select extract(epoch from (max(${jobs.createdAt}) - min(${jobs.createdAt}))) / 86400 / (count(*) - 1) as gap_days
        from ${jobs}
        where ${jobs.companyId} = ${companyId} and ${jobs.type} = 'Breakdown' and ${jobs.assetId} is not null
        group by ${jobs.assetId} having count(*) >= 2
      ) per_asset
    `)).rows as any[];

    const [mttr] = (await db.execute(sql`
      select avg(extract(epoch from (${jobs.completedAt} - ${jobs.createdAt})) / 3600) as mean_hours
      from ${jobs}
      where ${jobs.companyId} = ${companyId} and ${jobs.type} = 'Breakdown'
        and ${jobs.completedAt} >= now() - interval '90 days'
    `)).rows as any[];

    const stockValue = (await db.execute(sql`
      select ${inventory.category} as category,
        coalesce(sum(${inventory.stock} * ${inventory.unitCost}), 0) as value,
        count(*) filter (where ${inventory.unitCost} is null) as uncosted
      from ${inventory} where ${inventory.companyId} = ${companyId}
      group by ${inventory.category} order by value desc
    `)).rows as any[];

    const top = (await db.execute(sql`
      select ${jobs.assetId} as asset_id, max(${assets.name}) as name, count(*) as breakdowns
      from ${jobs}
      join ${assets} on ${assets.companyId} = ${jobs.companyId} and ${assets.id} = ${jobs.assetId}
      where ${jobs.companyId} = ${companyId} and ${jobs.type} = 'Breakdown'
        and ${jobs.createdAt} >= now() - interval '12 months'
      group by ${jobs.assetId} order by breakdowns desc, asset_id limit 10
    `)).rows as any[];

    return {
      openJobs: num(jobCounts?.open_jobs),
      openedThisWeek: num(jobCounts?.opened_this),
      openedLastWeek: num(jobCounts?.opened_last),
      completedThisWeek: num(jobCounts?.completed_this),
      completedLastWeek: num(jobCounts?.completed_last),
      assetsDown: num(assetCounts?.down),
      assetsTotal: num(assetCounts?.total),
      lowStock: num(stockCounts?.low),
      daily: daily.map((r) => ({ day: String(r.day), opened: num(r.opened), completed: num(r.completed) })),
      mtbfDays: mtbf?.median_days == null ? null : Math.round(Number(mtbf.median_days) * 10) / 10,
      mttrHours: mttr?.mean_hours == null ? null : Math.round(Number(mttr.mean_hours) * 10) / 10,
      stockValueByCategory: stockValue.map((r) => ({ category: String(r.category), value: Math.round(Number(r.value) * 100) / 100, uncosted: num(r.uncosted) })),
      topBreakdownAssets: top.map((r) => ({ assetId: String(r.asset_id), name: String(r.name), breakdowns: num(r.breakdowns) })),
    };
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
    return db.select().from(stockTransactions).where(eq(stockTransactions.companyId, companyId))
      .orderBy(desc(stockTransactions.createdAt), desc(stockTransactions.id));
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
