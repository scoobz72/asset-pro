import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { isPrivileged, requirePrivileged, requirePlatformAdmin, companyOf } from "./auth";
import {
  insertUserSchema, updateUserSchema,
  insertSiteSchema, updateSiteSchema,
  insertLocationSchema, updateLocationSchema,
  insertStoreRoomSchema, updateStoreRoomSchema,
  insertBinSchema, updateBinSchema,
  insertAssetSchema, updateAssetSchema, assetPartsInputSchema,
  insertInventorySchema, updateInventorySchema,
  insertSupplierSchema, updateSupplierSchema,
  insertJobSchema, updateJobSchema,
  insertTemplateSchema, updateTemplateSchema,
  insertStockTransactionSchema,
  insertPurchaseOrderSchema, updatePurchaseOrderSchema,
  insertAssetAuditSchema, updateAssetAuditSchema,
  insertMaintenanceRequestSchema, updateMaintenanceRequestSchema,
  createCompanySchema, updateCompanySchema, updateAccessRequestSchema, PLATFORM_ADMIN_ROLE,
} from "@shared/schema";

/**
 * Validates the request body against an allow-list schema. Unknown keys are stripped,
 * so callers can only write the columns the schema declares. Returns undefined (after
 * sending a 400) when the body is invalid.
 */
function parseBody<S extends z.ZodTypeAny>(schema: S, req: Request, res: Response): z.infer<S> | undefined {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: fromZodError(result.error as any).toString() });
    return undefined;
  }
  return result.data;
}

/** Like parseBody, but rejects updates that contain no recognised fields. */
function parseUpdate<S extends z.ZodTypeAny>(schema: S, req: Request, res: Response): z.infer<S> | undefined {
  const data = parseBody(schema, req, res);
  if (data === undefined) return undefined;
  if (Object.keys(data as object).length === 0) {
    res.status(400).json({ message: "No updatable fields provided" });
    return undefined;
  }
  return data;
}

function parseUserId(req: Request, res: Response): number | undefined {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid id" });
    return undefined;
  }
  return id;
}

// Purchase-order decisions that only Managers/Admins may make.
const PO_APPROVAL_STATUSES = new Set(["Approved", "Rejected"]);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // All routes below are mounted after the authentication middleware in setupAuth,
  // so every request here already has an authenticated req.user. Every storage call
  // is scoped to companyOf(req), the signed-in user's company from the session;
  // a company id is never taken from the request.

  // ===== USERS =====
  app.get("/api/users", async (req, res) => {
    const data = await storage.getUsers(companyOf(req));
    res.json(data);
  });
  app.post("/api/users", requirePrivileged, async (req, res) => {
    const data = parseBody(insertUserSchema, req, res);
    if (!data) return;
    const user = await storage.createUser(companyOf(req), data);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", requirePrivileged, async (req, res) => {
    const id = parseUserId(req, res);
    if (id === undefined) return;
    const data = parseUpdate(updateUserSchema, req, res);
    if (!data) return;
    const existing = (await storage.getUsers(companyOf(req))).find((u) => u.id === id);
    if (!existing) return res.status(404).json({ message: "User not found" });
    if (existing.role === PLATFORM_ADMIN_ROLE && data.role !== undefined) {
      return res.status(400).json({ message: "The platform admin's role cannot be changed here" });
    }
    const user = await storage.updateUser(companyOf(req), id, data);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  // ===== SITES =====
  app.get("/api/sites", async (req, res) => {
    const data = await storage.getSites(companyOf(req));
    res.json(data);
  });
  app.post("/api/sites", async (req, res) => {
    const data = parseBody(insertSiteSchema, req, res);
    if (!data) return;
    const site = await storage.createSite(companyOf(req), data);
    res.status(201).json(site);
  });
  app.patch("/api/sites/:id", async (req, res) => {
    const data = parseUpdate(updateSiteSchema, req, res);
    if (!data) return;
    const site = await storage.updateSite(companyOf(req), String(req.params.id), data);
    if (!site) return res.status(404).json({ message: "Site not found" });
    res.json(site);
  });
  app.delete("/api/sites/:id", requirePrivileged, async (req, res) => {
    await storage.deleteSite(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== LOCATIONS =====
  app.get("/api/locations", async (req, res) => {
    const data = await storage.getLocations(companyOf(req));
    res.json(data);
  });
  app.post("/api/locations", async (req, res) => {
    const data = parseBody(insertLocationSchema, req, res);
    if (!data) return;
    const loc = await storage.createLocation(companyOf(req), data);
    res.status(201).json(loc);
  });
  app.patch("/api/locations/:id", async (req, res) => {
    const data = parseUpdate(updateLocationSchema, req, res);
    if (!data) return;
    const loc = await storage.updateLocation(companyOf(req), String(req.params.id), data);
    if (!loc) return res.status(404).json({ message: "Location not found" });
    res.json(loc);
  });
  app.delete("/api/locations/:id", requirePrivileged, async (req, res) => {
    await storage.deleteLocation(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== STORE ROOMS & BINS =====
  app.get("/api/store-rooms", async (req, res) => {
    res.json(await storage.getStoreRooms(companyOf(req)));
  });
  app.post("/api/store-rooms", async (req, res) => {
    const data = parseBody(insertStoreRoomSchema, req, res);
    if (!data) return;
    res.status(201).json(await storage.createStoreRoom(companyOf(req), data));
  });
  app.patch("/api/store-rooms/:id", async (req, res) => {
    const data = parseUpdate(updateStoreRoomSchema, req, res);
    if (!data) return;
    const room = await storage.updateStoreRoom(companyOf(req), String(req.params.id), data);
    if (!room) return res.status(404).json({ message: "Store room not found" });
    res.json(room);
  });
  app.delete("/api/store-rooms/:id", requirePrivileged, async (req, res) => {
    await storage.deleteStoreRoom(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  app.get("/api/bins", async (req, res) => {
    res.json(await storage.getBins(companyOf(req)));
  });
  app.post("/api/bins", async (req, res) => {
    const data = parseBody(insertBinSchema, req, res);
    if (!data) return;
    res.status(201).json(await storage.createBin(companyOf(req), data));
  });
  app.patch("/api/bins/:id", async (req, res) => {
    const data = parseUpdate(updateBinSchema, req, res);
    if (!data) return;
    const bin = await storage.updateBin(companyOf(req), String(req.params.id), data);
    if (!bin) return res.status(404).json({ message: "Bin not found" });
    res.json(bin);
  });
  app.delete("/api/bins/:id", requirePrivileged, async (req, res) => {
    await storage.deleteBin(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== DASHBOARD =====
  app.get("/api/dashboard/summary", async (req, res) => {
    res.json(await storage.getDashboardSummary(companyOf(req)));
  });

  // ===== ASSETS =====
  app.get("/api/assets", async (req, res) => {
    const data = await storage.getAssets(companyOf(req));
    res.json(data);
  });
  app.get("/api/assets/:id", async (req, res) => {
    const asset = await storage.getAsset(companyOf(req), String(req.params.id));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  });
  app.post("/api/assets", async (req, res) => {
    const data = parseBody(insertAssetSchema.extend({ partsUsed: assetPartsInputSchema.optional() }), req, res);
    if (!data) return;
    const { partsUsed, ...assetData } = data;
    const asset = await storage.createAsset(companyOf(req), assetData);
    if (partsUsed && partsUsed.length > 0) {
      await storage.setAssetParts(companyOf(req), asset.id, partsUsed);
    }
    res.status(201).json(asset);
  });
  app.patch("/api/assets/:id", async (req, res) => {
    const data = parseBody(updateAssetSchema.extend({ partsUsed: assetPartsInputSchema.optional() }), req, res);
    if (!data) return;
    const { partsUsed, ...assetData } = data;
    const asset = Object.keys(assetData).length > 0
      ? await storage.updateAsset(companyOf(req), String(req.params.id), assetData)
      : await storage.getAsset(companyOf(req), String(req.params.id));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (partsUsed !== undefined) {
      await storage.setAssetParts(companyOf(req), asset.id, partsUsed);
    }
    res.json(asset);
  });
  app.delete("/api/assets/:id", requirePrivileged, async (req, res) => {
    await storage.deleteAsset(companyOf(req), String(req.params.id));
    res.status(204).end();
  });
  app.get("/api/asset-parts", async (req, res) => {
    res.json(await storage.getAllAssetParts(companyOf(req)));
  });
  app.get("/api/assets/:id/parts", async (req, res) => {
    const parts = await storage.getAssetParts(companyOf(req), String(req.params.id));
    res.json(parts);
  });

  // ===== INVENTORY =====
  app.get("/api/inventory", async (req, res) => {
    const data = await storage.getInventory(companyOf(req));
    res.json(data);
  });
  app.get("/api/inventory/:id", async (req, res) => {
    const item = await storage.getInventoryItem(companyOf(req), String(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.post("/api/inventory", async (req, res) => {
    const data = parseBody(insertInventorySchema, req, res);
    if (!data) return;
    const item = await storage.createInventoryItem(companyOf(req), data);
    res.status(201).json(item);
  });
  app.patch("/api/inventory/:id", async (req, res) => {
    const data = parseUpdate(updateInventorySchema, req, res);
    if (!data) return;
    const item = await storage.updateInventoryItem(companyOf(req), String(req.params.id), data);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.delete("/api/inventory/:id", requirePrivileged, async (req, res) => {
    await storage.deleteInventoryItem(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== SUPPLIERS =====
  app.get("/api/suppliers", async (req, res) => {
    const data = await storage.getSuppliers(companyOf(req));
    res.json(data);
  });
  app.post("/api/suppliers", async (req, res) => {
    const data = parseBody(insertSupplierSchema, req, res);
    if (!data) return;
    const supplier = await storage.createSupplier(companyOf(req), data);
    res.status(201).json(supplier);
  });
  app.patch("/api/suppliers/:id", async (req, res) => {
    const data = parseUpdate(updateSupplierSchema, req, res);
    if (!data) return;
    const supplier = await storage.updateSupplier(companyOf(req), String(req.params.id), data);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  });
  app.delete("/api/suppliers/:id", requirePrivileged, async (req, res) => {
    await storage.deleteSupplier(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== JOBS =====
  app.get("/api/jobs", async (req, res) => {
    const data = await storage.getJobs(companyOf(req));
    res.json(data);
  });
  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJob(companyOf(req), String(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.post("/api/jobs", async (req, res) => {
    const data = parseBody(insertJobSchema, req, res);
    if (!data) return;
    const job = await storage.createJob(companyOf(req), data);
    res.status(201).json(job);
  });
  app.patch("/api/jobs/:id", async (req, res) => {
    const data = parseUpdate(updateJobSchema, req, res);
    if (!data) return;
    const job = await storage.updateJob(companyOf(req), String(req.params.id), data);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.delete("/api/jobs/:id", requirePrivileged, async (req, res) => {
    await storage.deleteJob(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== TEMPLATES =====
  app.get("/api/templates", async (req, res) => {
    const data = await storage.getTemplates(companyOf(req));
    res.json(data);
  });
  app.post("/api/templates", async (req, res) => {
    const data = parseBody(insertTemplateSchema, req, res);
    if (!data) return;
    const tpl = await storage.createTemplate(companyOf(req), data);
    res.status(201).json(tpl);
  });
  app.patch("/api/templates/:id", async (req, res) => {
    const data = parseUpdate(updateTemplateSchema, req, res);
    if (!data) return;
    const tpl = await storage.updateTemplate(companyOf(req), String(req.params.id), data);
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(tpl);
  });
  app.delete("/api/templates/:id", requirePrivileged, async (req, res) => {
    await storage.deleteTemplate(companyOf(req), String(req.params.id));
    res.status(204).end();
  });

  // ===== STOCK TRANSACTIONS =====
  app.get("/api/transactions", async (req, res) => {
    const data = await storage.getStockTransactions(companyOf(req));
    res.json(data);
  });
  app.post("/api/transactions", async (req, res) => {
    const data = parseBody(insertStockTransactionSchema, req, res);
    if (!data) return;
    const txn = await storage.createStockTransaction(companyOf(req), data);
    res.status(201).json(txn);
  });

  // ===== PURCHASE ORDERS =====
  app.get("/api/purchase-orders", async (req, res) => {
    const data = await storage.getPurchaseOrders(companyOf(req));
    res.json(data);
  });
  app.post("/api/purchase-orders", async (req, res) => {
    const data = parseBody(insertPurchaseOrderSchema, req, res);
    if (!data) return;
    if (data.status && PO_APPROVAL_STATUSES.has(data.status) && !isPrivileged(req.user)) {
      return res.status(403).json({ message: "Only managers can approve or reject purchase orders" });
    }
    const po = await storage.createPurchaseOrder(companyOf(req), data);
    res.status(201).json(po);
  });
  app.patch("/api/purchase-orders/:id", async (req, res) => {
    const data = parseUpdate(updatePurchaseOrderSchema, req, res);
    if (!data) return;
    if (data.status && PO_APPROVAL_STATUSES.has(data.status) && !isPrivileged(req.user)) {
      return res.status(403).json({ message: "Only managers can approve or reject purchase orders" });
    }
    const po = await storage.updatePurchaseOrder(companyOf(req), String(req.params.id), data);
    if (!po) return res.status(404).json({ message: "PO not found" });
    res.json(po);
  });

  // ===== ASSET AUDITS =====
  app.get("/api/audits", async (req, res) => {
    const data = await storage.getAssetAudits(companyOf(req));
    res.json(data);
  });
  app.post("/api/audits", async (req, res) => {
    const data = parseBody(insertAssetAuditSchema, req, res);
    if (!data) return;
    const audit = await storage.createAssetAudit(companyOf(req), data);
    res.status(201).json(audit);
  });
  app.patch("/api/audits/:id", async (req, res) => {
    const data = parseUpdate(updateAssetAuditSchema, req, res);
    if (!data) return;
    const audit = await storage.updateAssetAudit(companyOf(req), String(req.params.id), data);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json(audit);
  });

  // ===== MAINTENANCE REQUESTS =====
  app.get("/api/maintenance-requests", async (req, res) => {
    const data = await storage.getMaintenanceRequests(companyOf(req));
    res.json(data);
  });
  app.post("/api/maintenance-requests", async (req, res) => {
    const data = parseBody(insertMaintenanceRequestSchema, req, res);
    if (!data) return;
    const request = await storage.createMaintenanceRequest(companyOf(req), data);
    res.status(201).json(request);
  });
  app.patch("/api/maintenance-requests/:id", async (req, res) => {
    const data = parseUpdate(updateMaintenanceRequestSchema, req, res);
    if (!data) return;
    const request = await storage.updateMaintenanceRequest(companyOf(req), String(req.params.id), data);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  });

  // ===== PLATFORM ADMIN (manages companies; not company-scoped) =====
  app.get("/api/platform/companies", requirePlatformAdmin, async (_req, res) => {
    res.json(await storage.listCompanies());
  });
  app.post("/api/platform/companies", requirePlatformAdmin, async (req, res) => {
    const data = parseBody(createCompanySchema, req, res);
    if (!data) return;
    const result = await storage.createCompanyWithManager(data);
    res.status(201).json(result);
  });
  app.patch("/api/platform/companies/:id", requirePlatformAdmin, async (req, res) => {
    const id = parseUserId(req, res);
    if (id === undefined) return;
    const data = parseUpdate(updateCompanySchema, req, res);
    if (!data) return;
    if (data.status === "Suspended" && id === companyOf(req)) {
      return res.status(400).json({ message: "You cannot suspend your own company" });
    }
    const company = await storage.updateCompany(id, data);
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  });
  app.get("/api/platform/access-requests", requirePlatformAdmin, async (_req, res) => {
    res.json(await storage.listAccessRequests());
  });
  app.patch("/api/platform/access-requests/:id", requirePlatformAdmin, async (req, res) => {
    const id = parseUserId(req, res);
    if (id === undefined) return;
    const data = parseBody(updateAccessRequestSchema, req, res);
    if (!data) return;
    const request = await storage.updateAccessRequest(id, data.status);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  });

  // Unknown /api routes must not fall through to the SPA handler.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  return httpServer;
}
