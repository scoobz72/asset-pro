import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ===== USERS =====
  app.get("/api/users", async (_req, res) => {
    const data = await storage.getUsers();
    res.json(data);
  });
  app.post("/api/users", async (req, res) => {
    const user = await storage.createUser(req.body);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", async (req, res) => {
    const user = await storage.updateUser(parseInt(req.params.id), req.body);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  // ===== SITES =====
  app.get("/api/sites", async (_req, res) => {
    const data = await storage.getSites();
    res.json(data);
  });
  app.post("/api/sites", async (req, res) => {
    const site = await storage.createSite(req.body);
    res.status(201).json(site);
  });
  app.patch("/api/sites/:id", async (req, res) => {
    const site = await storage.updateSite(req.params.id, req.body);
    if (!site) return res.status(404).json({ message: "Site not found" });
    res.json(site);
  });
  app.delete("/api/sites/:id", async (req, res) => {
    await storage.deleteSite(req.params.id);
    res.status(204).end();
  });

  // ===== LOCATIONS =====
  app.get("/api/locations", async (_req, res) => {
    const data = await storage.getLocations();
    res.json(data);
  });
  app.post("/api/locations", async (req, res) => {
    const loc = await storage.createLocation(req.body);
    res.status(201).json(loc);
  });
  app.patch("/api/locations/:id", async (req, res) => {
    const loc = await storage.updateLocation(req.params.id, req.body);
    if (!loc) return res.status(404).json({ message: "Location not found" });
    res.json(loc);
  });
  app.delete("/api/locations/:id", async (req, res) => {
    await storage.deleteLocation(req.params.id);
    res.status(204).end();
  });

  // ===== ASSETS =====
  app.get("/api/assets", async (_req, res) => {
    const data = await storage.getAssets();
    res.json(data);
  });
  app.get("/api/assets/:id", async (req, res) => {
    const asset = await storage.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  });
  app.post("/api/assets", async (req, res) => {
    const { partsUsed, ...assetData } = req.body;
    const asset = await storage.createAsset(assetData);
    if (partsUsed && partsUsed.length > 0) {
      await storage.setAssetParts(asset.id, partsUsed);
    }
    res.status(201).json(asset);
  });
  app.patch("/api/assets/:id", async (req, res) => {
    const { partsUsed, ...assetData } = req.body;
    const asset = await storage.updateAsset(req.params.id, assetData);
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (partsUsed !== undefined) {
      await storage.setAssetParts(asset.id, partsUsed);
    }
    res.json(asset);
  });
  app.delete("/api/assets/:id", async (req, res) => {
    await storage.deleteAsset(req.params.id);
    res.status(204).end();
  });
  app.get("/api/assets/:id/parts", async (req, res) => {
    const parts = await storage.getAssetParts(req.params.id);
    res.json(parts);
  });

  // ===== INVENTORY =====
  app.get("/api/inventory", async (_req, res) => {
    const data = await storage.getInventory();
    res.json(data);
  });
  app.get("/api/inventory/:id", async (req, res) => {
    const item = await storage.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.post("/api/inventory", async (req, res) => {
    const item = await storage.createInventoryItem(req.body);
    res.status(201).json(item);
  });
  app.patch("/api/inventory/:id", async (req, res) => {
    const item = await storage.updateInventoryItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });
  app.delete("/api/inventory/:id", async (req, res) => {
    await storage.deleteInventoryItem(req.params.id);
    res.status(204).end();
  });

  // ===== SUPPLIERS =====
  app.get("/api/suppliers", async (_req, res) => {
    const data = await storage.getSuppliers();
    res.json(data);
  });
  app.post("/api/suppliers", async (req, res) => {
    const supplier = await storage.createSupplier(req.body);
    res.status(201).json(supplier);
  });
  app.patch("/api/suppliers/:id", async (req, res) => {
    const supplier = await storage.updateSupplier(req.params.id, req.body);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    res.json(supplier);
  });
  app.delete("/api/suppliers/:id", async (req, res) => {
    await storage.deleteSupplier(req.params.id);
    res.status(204).end();
  });

  // ===== JOBS =====
  app.get("/api/jobs", async (_req, res) => {
    const data = await storage.getJobs();
    res.json(data);
  });
  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJob(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.post("/api/jobs", async (req, res) => {
    const job = await storage.createJob(req.body);
    res.status(201).json(job);
  });
  app.patch("/api/jobs/:id", async (req, res) => {
    const job = await storage.updateJob(req.params.id, req.body);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });
  app.delete("/api/jobs/:id", async (req, res) => {
    await storage.deleteJob(req.params.id);
    res.status(204).end();
  });

  // ===== TEMPLATES =====
  app.get("/api/templates", async (_req, res) => {
    const data = await storage.getTemplates();
    res.json(data);
  });
  app.post("/api/templates", async (req, res) => {
    const tpl = await storage.createTemplate(req.body);
    res.status(201).json(tpl);
  });
  app.patch("/api/templates/:id", async (req, res) => {
    const tpl = await storage.updateTemplate(req.params.id, req.body);
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(tpl);
  });
  app.delete("/api/templates/:id", async (req, res) => {
    await storage.deleteTemplate(req.params.id);
    res.status(204).end();
  });

  // ===== STOCK TRANSACTIONS =====
  app.get("/api/transactions", async (_req, res) => {
    const data = await storage.getStockTransactions();
    res.json(data);
  });
  app.post("/api/transactions", async (req, res) => {
    const txn = await storage.createStockTransaction(req.body);
    res.status(201).json(txn);
  });

  // ===== PURCHASE ORDERS =====
  app.get("/api/purchase-orders", async (_req, res) => {
    const data = await storage.getPurchaseOrders();
    res.json(data);
  });
  app.post("/api/purchase-orders", async (req, res) => {
    const po = await storage.createPurchaseOrder(req.body);
    res.status(201).json(po);
  });
  app.patch("/api/purchase-orders/:id", async (req, res) => {
    const po = await storage.updatePurchaseOrder(req.params.id, req.body);
    if (!po) return res.status(404).json({ message: "PO not found" });
    res.json(po);
  });

  // ===== ASSET AUDITS =====
  app.get("/api/audits", async (_req, res) => {
    const data = await storage.getAssetAudits();
    res.json(data);
  });
  app.post("/api/audits", async (req, res) => {
    const audit = await storage.createAssetAudit(req.body);
    res.status(201).json(audit);
  });
  app.patch("/api/audits/:id", async (req, res) => {
    const audit = await storage.updateAssetAudit(req.params.id, req.body);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json(audit);
  });

  // ===== MAINTENANCE REQUESTS =====
  app.get("/api/maintenance-requests", async (_req, res) => {
    const data = await storage.getMaintenanceRequests();
    res.json(data);
  });
  app.post("/api/maintenance-requests", async (req, res) => {
    const request = await storage.createMaintenanceRequest(req.body);
    res.status(201).json(request);
  });
  app.patch("/api/maintenance-requests/:id", async (req, res) => {
    const request = await storage.updateMaintenanceRequest(req.params.id, req.body);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  });

  // ===== SEED DATA =====
  app.post("/api/seed", async (_req, res) => {
    try {
      const existingUsers = await storage.getUsers();
      if (existingUsers.length > 0) {
        return res.json({ message: "Data already seeded" });
      }

      await storage.createUser({ name: "John Doe", role: "Manager", status: "Active", avatar: "https://i.pravatar.cc/150?u=1", email: "john@promaintain.app" });
      await storage.createUser({ name: "Sarah Smith", role: "Technician", status: "Busy", avatar: "https://i.pravatar.cc/150?u=2", email: "sarah@promaintain.app" });
      await storage.createUser({ name: "Mike Johnson", role: "Technician", status: "Available", avatar: "https://i.pravatar.cc/150?u=3", email: "mike@promaintain.app" });
      await storage.createUser({ name: "Emily Davis", role: "Technician", status: "Offline", avatar: "https://i.pravatar.cc/150?u=4", email: "emily@promaintain.app" });

      await storage.createSite({ id: "SITE-001", name: "Main Production Facility" });
      await storage.createSite({ id: "SITE-002", name: "Logistics Hub" });

      await storage.createLocation({ id: "LOC-101", name: "Building A", siteId: "SITE-001" });
      await storage.createLocation({ id: "LOC-102", name: "Roof", siteId: "SITE-001" });
      await storage.createLocation({ id: "LOC-103", name: "Basement", siteId: "SITE-001" });
      await storage.createLocation({ id: "LOC-104", name: "Workshop", siteId: "SITE-001" });
      await storage.createLocation({ id: "LOC-201", name: "Zone 1", siteId: "SITE-002" });
      await storage.createLocation({ id: "LOC-202", name: "Building B", siteId: "SITE-002" });

      await storage.createSupplier({ id: "SUP-001", name: "Industrial Supply Co", categories: ["Consumables", "Spares", "Tools"], rating: "4.8", leadTime: "2-3 days", contact: "sales@industrialsupply.com" });
      await storage.createSupplier({ id: "SUP-002", name: "Fluid Dynamics Inc", categories: ["Fluids", "Lubricants", "Pumps"], rating: "4.5", leadTime: "1-2 days", contact: "orders@fluiddynamics.com" });
      await storage.createSupplier({ id: "SUP-003", name: "Global Bearings", categories: ["Spares", "Bearings", "Motors"], rating: "4.9", leadTime: "3-5 days", contact: "support@globalbearings.com" });
      await storage.createSupplier({ id: "SUP-004", name: "Safety First Gear", categories: ["PPE", "Safety", "Uniforms"], rating: "4.2", leadTime: "1 day", contact: "sales@safetyfirst.com" });
      await storage.createSupplier({ id: "SUP-005", name: "FastParts Logistics", categories: ["Consumables", "Electrical", "Spares"], rating: "3.9", leadTime: "1-2 days", contact: "urgent@fastparts.com" });

      await storage.createInventoryItem({ id: "PART-001", name: "Filter Type A", category: "Consumables", stock: 45, minStock: 10, unit: "pcs", location: "Shelf A1", lastUsed: "2023-11-10", lastStockTaken: "2023-11-01", lastReplenished: "2023-10-15", leadTime: 2, primarySupplierId: "SUP-001", secondarySupplierId: "SUP-005" });
      await storage.createInventoryItem({ id: "PART-002", name: "Hydraulic Fluid", category: "Fluids", stock: 120, minStock: 50, unit: "L", location: "Cabinet B", lastUsed: "2023-11-12", lastStockTaken: "2023-10-25", lastReplenished: "2023-09-01", leadTime: 5, primarySupplierId: "SUP-002", secondarySupplierId: "SUP-001" });
      await storage.createInventoryItem({ id: "PART-003", name: "Bearing 6204", category: "Spares", stock: 4, minStock: 10, unit: "pcs", location: "Shelf C3", lastUsed: "2023-11-05", lastStockTaken: "2023-11-05", lastReplenished: "2023-05-12", leadTime: 14, primarySupplierId: "SUP-003", secondarySupplierId: "SUP-001" });
      await storage.createInventoryItem({ id: "PART-004", name: "V-Belt B52", category: "Spares", stock: 8, minStock: 5, unit: "pcs", location: "Shelf C4", lastUsed: "2023-10-28", lastStockTaken: "2023-11-01", lastReplenished: "2023-08-20", leadTime: 4, primarySupplierId: "SUP-001", secondarySupplierId: "SUP-005" });
      await storage.createInventoryItem({ id: "PART-005", name: "Safety Gloves", category: "PPE", stock: 200, minStock: 50, unit: "pairs", location: "Locker 1", lastUsed: "2023-11-14", lastStockTaken: "2023-11-10", lastReplenished: "2023-11-05", leadTime: 1, primarySupplierId: "SUP-004", secondarySupplierId: "SUP-005" });

      await storage.createAsset({ id: "A-101", name: "Hydraulic Press #4", locationId: "LOC-101", status: "Operational", health: 98, lastService: "2023-10-15" });
      await storage.createAsset({ id: "A-102", name: "Conveyor Belt Main", locationId: "LOC-101", status: "Maintenance", health: 45, lastService: "2023-11-01" });
      await storage.createAsset({ id: "A-201", name: "Cooling Tower B", locationId: "LOC-102", status: "Operational", health: 92, lastService: "2023-09-20" });
      await storage.createAsset({ id: "A-205", name: "Generator Backup", locationId: "LOC-103", status: "Down", health: 0, lastService: "2023-08-10" });
      await storage.createAsset({ id: "A-301", name: "CNC Machine X1", locationId: "LOC-104", status: "Operational", health: 88, lastService: "2023-10-25" });
      await storage.createAsset({ id: "A-401", name: "Forklift T2", locationId: "LOC-201", status: "Loaned Out", health: 100, lastService: "2023-11-05" });
      await storage.createAsset({ id: "A-402", name: "Spare Pump Unit", locationId: "LOC-202", status: "In Storage", health: 100, lastService: "2023-01-15" });

      await storage.setAssetParts("A-101", ["PART-002", "PART-003"]);
      await storage.setAssetParts("A-102", ["PART-004", "PART-001"]);
      await storage.setAssetParts("A-201", ["PART-001"]);
      await storage.setAssetParts("A-205", ["PART-005", "PART-002", "PART-003"]);
      await storage.setAssetParts("A-301", ["PART-002"]);

      const now = new Date();
      const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000).toISOString().split("T")[0];

      await storage.createJob({ id: "JOB-1001", title: "Monthly Inspection", assetId: "A-101", priority: "Medium", status: "Open", assigneeId: 2, dueDate: addDays(now, 2) });
      await storage.createJob({ id: "JOB-1002", title: "Belt Replacement", assetId: "A-102", priority: "High", status: "In Progress", assigneeId: 3, dueDate: addDays(now, 0) });
      await storage.createJob({ id: "JOB-1003", title: "Oil Change", assetId: "A-301", priority: "Low", status: "Completed", assigneeId: 2, dueDate: addDays(now, -2) });
      await storage.createJob({ id: "JOB-1004", title: "Emergency Repair", assetId: "A-205", priority: "Critical", status: "Open", assigneeId: null, dueDate: addDays(now, -1) });
      await storage.createJob({ id: "JOB-1005", title: "Filter Cleaning", assetId: "A-201", priority: "Medium", status: "Scheduled", assigneeId: 3, dueDate: addDays(now, 5) });

      await storage.createTemplate({ id: "TPL-001", name: "Standard Breakdown Report", type: "Breakdown", description: "Generic template for unexpected equipment failures.", steps: [{ id: 1, text: "Isolate equipment and apply LOTO", required: true }, { id: 2, text: "Identify root cause of failure", required: true }, { id: 3, text: "Perform necessary repairs/part replacements", required: true }, { id: 4, text: "Test equipment functionality post-repair", required: true }, { id: 5, text: "Remove LOTO and return to service", required: true }, { id: 6, text: "Clean work area", required: false }], signOffs: ["Lead Engineer"] });
      await storage.createTemplate({ id: "TPL-002", name: "Hydraulic Press PM - Monthly", type: "Planned", description: "Monthly maintenance for hydraulic presses.", steps: [{ id: 1, text: "Check fluid levels and top up", required: true }, { id: 2, text: "Inspect hoses for leaks or wear", required: true }, { id: 3, text: "Verify pressure gauge readings", required: true }, { id: 4, text: "Lubricate guide rails", required: true }, { id: 5, text: "Test emergency stop", required: true }], signOffs: ["Technician", "Safety Officer"] });
      await storage.createTemplate({ id: "TPL-003", name: "HVAC Filter Replacement", type: "Planned", description: "Quarterly filter replacement for HVAC systems.", steps: [{ id: 1, text: "Turn off HVAC unit power", required: true }, { id: 2, text: "Remove old filters", required: true }, { id: 3, text: "Vacuum filter housing", required: false }, { id: 4, text: "Install new filters", required: true }, { id: 5, text: "Restore power and verify airflow", required: true }], signOffs: ["Technician"] });

      await storage.createStockTransaction({ id: "TXN-001", date: "2023-11-15T08:30:00", partId: "PART-001", partName: "Filter Type A", type: "Job Book Out", quantity: -2, userId: "Sarah Smith", reference: "JOB-1002" });
      await storage.createStockTransaction({ id: "TXN-002", date: "2023-11-14T14:15:00", partId: "PART-005", partName: "Safety Gloves", type: "Stock Out - Damaged", quantity: -5, userId: "John Doe", reference: "Cycle Check" });
      await storage.createStockTransaction({ id: "TXN-003", date: "2023-11-12T10:00:00", partId: "PART-002", partName: "Hydraulic Fluid", type: "Purchase Order", quantity: 50, userId: "System", reference: "PO-2023-089" });
      await storage.createStockTransaction({ id: "TXN-004", date: "2023-11-10T09:45:00", partId: "PART-003", partName: "Bearing 6204", type: "Transfer In", quantity: 10, userId: "Mike Johnson", reference: "From Factory B" });
      await storage.createStockTransaction({ id: "TXN-005", date: "2023-11-08T16:20:00", partId: "PART-004", partName: "V-Belt B52", type: "Job Book Out", quantity: -1, userId: "Sarah Smith", reference: "JOB-0988" });
      await storage.createStockTransaction({ id: "TXN-006", date: "2023-11-07T11:20:00", partId: "PART-004", partName: "V-Belt B52", type: "Stock In", quantity: 2, userId: "Mike Johnson", reference: "Cycle Check" });
      await storage.createStockTransaction({ id: "TXN-007", date: "2023-11-06T09:10:00", partId: "PART-001", partName: "Filter Type A", type: "Stock Out - Missing", quantity: -1, userId: "John Doe", reference: "Cycle Check" });

      await storage.createPurchaseOrder({ id: "PO-2023-090", vendor: "Industrial Supply Co", status: "Pending Approval", total: "1250.00", requestedBy: "Emily Davis (Lead)", date: "2023-11-16", items: 3 });
      await storage.createPurchaseOrder({ id: "PO-2023-089", vendor: "Fluid Dynamics Inc", status: "Received", total: "450.00", requestedBy: "Mike Johnson (Lead)", date: "2023-11-10", items: 1 });
      await storage.createPurchaseOrder({ id: "PO-2023-088", vendor: "Safety First Gear", status: "Approved", total: "890.50", requestedBy: "Admin User", date: "2023-11-15", items: 4 });
      await storage.createPurchaseOrder({ id: "PO-2023-087", vendor: "Global Bearings", status: "Draft", total: "320.00", requestedBy: "Sarah Smith (Lead)", date: "2023-11-17", items: 2 });

      await storage.createAssetAudit({ id: "AUD-001", assetId: "A-101", status: "Pending", scheduledDate: "2023-11-20", assignedTo: "John Doe", expectedLocation: "Building A" });
      await storage.createAssetAudit({ id: "AUD-002", assetId: "A-201", status: "Completed", scheduledDate: "2023-11-15", assignedTo: "Sarah Smith", expectedLocation: "Roof", verifiedLocation: "Roof", completionDate: "2023-11-15T10:30:00" });
      await storage.createAssetAudit({ id: "AUD-003", assetId: "A-205", status: "Discrepancy", scheduledDate: "2023-11-18", assignedTo: "Mike Johnson", expectedLocation: "Basement", verifiedLocation: "Building B", completionDate: "2023-11-18T14:45:00", notes: "Asset was moved without updating system." });
      await storage.createAssetAudit({ id: "AUD-004", assetId: "A-301", status: "Scheduled", scheduledDate: "2023-12-05", assignedTo: "Emily Davis", expectedLocation: "Workshop" });

      res.json({ message: "Seed data created successfully" });
    } catch (error: any) {
      console.error("Seed error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
