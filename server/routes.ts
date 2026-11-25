import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { isPrivileged, requirePrivileged } from "./auth";
import {
  insertUserSchema, updateUserSchema,
  insertSiteSchema, updateSiteSchema,
  insertLocationSchema, updateLocationSchema,
  insertAssetSchema, updateAssetSchema, assetPartsInputSchema,
  insertInventorySchema, updateInventorySchema,
  insertSupplierSchema, updateSupplierSchema,
  insertJobSchema, updateJobSchema,
  insertTemplateSchema, updateTemplateSchema,
  insertStockTransactionSchema,
  insertPurchaseOrderSchema, updatePurchaseOrderSchema,
  insertAssetAuditSchema, updateAssetAuditSchema,
  insertMaintenanceRequestSchema, updateMaintenanceRequestSchema,
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
    res.status(400).json({ message: "Invalid user id" });
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
  // so every request here already has an authenticated req.user.

  // ===== USERS =====
  app.get("/api/users", async (_req, res) => {
    const data = await storage.getUsers();
    res.json(data);
  });
  app.post("/api/users", requirePrivileged, async (req, res) => {
    const data = parseBody(insertUserSchema, req, res);
    if (!data) return;
    const user = await storage.createUser(data);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", requirePrivileged, async (req, res) => {
    const id = parseUserId(req, res);
    if (id === undefined) return;
    const data = parseUpdate(updateUserSchema, req, res);
    if (!data) return;
    const user = await storage.updateUser(id, data);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  // ===== SITES =====
  app.get("/api/sites", async (_req, res) => {
    const data = await storage.getSites();
    res.json(data);
  });
  app.post("/api/sites", async (req, res) => {
    const data = parseBody(insertSiteSchema, req, res);
    if (!data) return;
    const site = await storage.createSite(data);
    res.status(201).json(site);
  });
  app.patch("/api/sites/:id", async (req, res) => {
    const data = parseUpdate(updateSiteSchema, req, res);
    if (!data) return;
    const site = await storage.updateSite(String(req.params.id), data);
    if (!site) return res.status(404).json({ message: "Site not found" });
    res.json(site);
  });
  app.delete("/api/sites/:id", requirePrivileged, async (req, res) => {
    await storage.deleteSite(String(req.params.id));
    res.status(204).end();
  });

  // ===== LOCATIONS =====
  app.get("/api/locations", async (_req, res) => {
    const data = await storage.getLocations();
    res.json(data);
  });
  app.post("/api/locations", async (req, res) => {
    const data = parseBody(insertLocationSchema, req, res);
    if (!data) return;
    const loc = await storage.createLocation(data);
    res.status(201).json(loc);
  });
  app.patch("/api/locations/:id", async (req, res) => {
    const data = parseUpdate(updateLocationSchema, req, res);
    if (!data) return;
    const loc = await storage.updateLocation(String(req.params.id), data);
    if (!loc) return res.status(404).json({ message: "Location not found" });
    res.json(loc);
  });
  app.delete("/api/locations/:id", requirePrivileged, async (req, res) => {
    await storage.deleteLocation(String(req.params.id));
    res.status(204).end();
  });

  // ===== ASSETS =====
  app.get("/api/assets", async (_req, res) => {
    const data = await storage.getAssets();
    res.json(data);
  });
  app.get("/api/assets/:id", async (req, res) => {
    const asset = await storage.getAsset(String(String(req.params.id)));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  });
  app.post("/api/assets", async (req, res) => {
    const data = parseBody(insertAssetSchema.extend({ partsUsed: assetPartsInputSchema.optional() }), req, res);
    if (!data) return;
    const { partsUsed, ...assetData } = data;
    const asset = await storage.createAsset(assetData);
    if (partsUsed && partsUsed.length > 0) {
      await storage.setAssetParts(asset.id, partsUsed);
    }
    res.status(201).json(asset);
  });
  app.patch("/api/assets/:id", async (req, res) => {
    const data = parseBody(updateAssetSchema.extend({ partsUsed: assetPartsInputSchema.optional() }), req, res);
    if (!data) return;
    const { partsUsed, ...assetData } = data;
    const asset = Object.keys(assetData).length > 0
      ? await storage.updateAsset(String(req.params.id), assetData)
      : await storage.getAsset(String(String(req.params.id)));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (partsUsed !== undefined) {
      await storage.setAssetParts(asset.id, partsUsed);
    }
    res.json(asset);
  });
  app.delete("/api/assets/:id", requirePrivileged, async (req, res) => {
    await storage.deleteAsset(String(req.params.id));
    res.status(204).end();
  });
  app.get("/api/assets/:id/parts", async (req, res) => {
    const parts = await storage.getAssetParts(String(req.params.id));
    res.json(parts);
  });

  // ===== INVENTORY =====
  app.get("/api/inventory", async (_req, res) => {
    const data = await storage.getInventory();
    res.json(data);
  });
  app.get("/api/inventory/:id", async (req, res) => {
    const item = await storage.getInventoryItem(String(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.post("/api/inventory", async (req, res) => {
    const data = parseBody(insertInventorySchema, req, res);
    if (!data) return;
    const item = await storage.createInventoryItem(data);
    res.status(201).json(item);
  });
  app.patch("/api/inventory/:id", async (req, res) => {
    const data = parseUpdate(updateInventorySchema, req, res);
    if (!data) return;
    const item = await storage.updateInventoryItem(String(req.params.id), data);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.delete("/api/inventory/:id", requirePrivileged, async (req, res) => {
    await storage.deleteInventoryItem(String(req.params.id));
    res.status(204).end();
  });

  // ===== SUPPLIERS =====
  app.get("/api/suppliers", async (_req, res) => {
    const data = await storage.getSuppliers();
    res.json(data);
  });
  app.post("/api/suppliers", async (req, res) => {
    const data = parseBody(insertSupplierSchema, req, res);
    if (!data) return;
    const supplier = await storage.createSupplier(data);
    res.status(201).json(supplier);
  });
  app.patch("/api/suppliers/:id", async (req, res) => {
    const data = parseUpdate(updateSupplierSchema, req, res);
    if (!data) return;
    const supplier = await storage.updateSupplier(String(req.params.id), data);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  });
  app.delete("/api/suppliers/:id", requirePrivileged, async (req, res) => {
    await storage.deleteSupplier(String(req.params.id));
    res.status(204).end();
  });

  // ===== JOBS =====
  app.get("/api/jobs", async (_req, res) => {
    const data = await storage.getJobs();
    res.json(data);
  });
  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJob(String(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.post("/api/jobs", async (req, res) => {
    const data = parseBody(insertJobSchema, req, res);
    if (!data) return;
    const job = await storage.createJob(data);
    res.status(201).json(job);
  });
  app.patch("/api/jobs/:id", async (req, res) => {
    const data = parseUpdate(updateJobSchema, req, res);
    if (!data) return;
    const job = await storage.updateJob(String(req.params.id), data);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.delete("/api/jobs/:id", requirePrivileged, async (req, res) => {
    await storage.deleteJob(String(req.params.id));
    res.status(204).end();
  });

  // ===== TEMPLATES =====
  app.get("/api/templates", async (_req, res) => {
    const data = await storage.getTemplates();
    res.json(data);
  });
  app.post("/api/templates", async (req, res) => {
    const data = parseBody(insertTemplateSchema, req, res);
    if (!data) return;
    const tpl = await storage.createTemplate(data);
    res.status(201).json(tpl);
  });
  app.patch("/api/templates/:id", async (req, res) => {
    const data = parseUpdate(updateTemplateSchema, req, res);
    if (!data) return;
    const tpl = await storage.updateTemplate(String(req.params.id), data);
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(tpl);
  });
  app.delete("/api/templates/:id", requirePrivileged, async (req, res) => {
    await storage.deleteTemplate(String(req.params.id));
    res.status(204).end();
  });

  // ===== STOCK TRANSACTIONS =====
  app.get("/api/transactions", async (_req, res) => {
    const data = await storage.getStockTransactions();
    res.json(data);
  });
  app.post("/api/transactions", async (req, res) => {
    const data = parseBody(insertStockTransactionSchema, req, res);
    if (!data) return;
    const txn = await storage.createStockTransaction(data);
    res.status(201).json(txn);
  });

  // ===== PURCHASE ORDERS =====
  app.get("/api/purchase-orders", async (_req, res) => {
    const data = await storage.getPurchaseOrders();
    res.json(data);
  });
  app.post("/api/purchase-orders", async (req, res) => {
    const data = parseBody(insertPurchaseOrderSchema, req, res);
    if (!data) return;
    if (data.status && PO_APPROVAL_STATUSES.has(data.status) && !isPrivileged(req.user)) {
      return res.status(403).json({ message: "Only managers can approve or reject purchase orders" });
    }
    const po = await storage.createPurchaseOrder(data);
    res.status(201).json(po);
  });
  app.patch("/api/purchase-orders/:id", async (req, res) => {
    const data = parseUpdate(updatePurchaseOrderSchema, req, res);
    if (!data) return;
    if (data.status && PO_APPROVAL_STATUSES.has(data.status) && !isPrivileged(req.user)) {
      return res.status(403).json({ message: "Only managers can approve or reject purchase orders" });
    }
    const po = await storage.updatePurchaseOrder(String(req.params.id), data);
    if (!po) return res.status(404).json({ message: "PO not found" });
    res.json(po);
  });

  // ===== ASSET AUDITS =====
  app.get("/api/audits", async (_req, res) => {
    const data = await storage.getAssetAudits();
    res.json(data);
  });
  app.post("/api/audits", async (req, res) => {
    const data = parseBody(insertAssetAuditSchema, req, res);
    if (!data) return;
    const audit = await storage.createAssetAudit(data);
    res.status(201).json(audit);
  });
  app.patch("/api/audits/:id", async (req, res) => {
    const data = parseUpdate(updateAssetAuditSchema, req, res);
    if (!data) return;
    const audit = await storage.updateAssetAudit(String(req.params.id), data);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json(audit);
  });

  // ===== MAINTENANCE REQUESTS =====
  app.get("/api/maintenance-requests", async (_req, res) => {
    const data = await storage.getMaintenanceRequests();
    res.json(data);
  });
  app.post("/api/maintenance-requests", async (req, res) => {
    const data = parseBody(insertMaintenanceRequestSchema, req, res);
    if (!data) return;
    const request = await storage.createMaintenanceRequest(data);
    res.status(201).json(request);
  });
  app.patch("/api/maintenance-requests/:id", async (req, res) => {
    const data = parseUpdate(updateMaintenanceRequestSchema, req, res);
    if (!data) return;
    const request = await storage.updateMaintenanceRequest(String(req.params.id), data);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  });

  // Unknown /api routes must not fall through to the SPA handler.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  return httpServer;
}
