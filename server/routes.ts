import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { submitRequest, convertRequest, rejectRequest, RequestError } from "./requests";
import { nextNumber } from "./numbering";
import { calendarItems } from "./calendar";
import { getJobDetail, addLabour, deleteLabour, addNote, createFollowUpJob, JobError } from "./jobs/records";
import { getShifts, savePattern, deletePattern, addAbsence, deleteAbsence, ShiftError } from "./people/shifts";
import { engineeringKpis } from "./kpi/kpis";
import { scheduleAreaAudit, scheduleAuditSchema, AuditError } from "./audits";
import { myDay, getTimer, startTimer, pauseTimer, stopTimer, timerStopSchema, lookupCode, commonPartsForAsset } from "./mobile";
import { jobs as jobsTable, assetAudits as assetAuditsTable } from "@shared/schema";
import { recordMovementNow, recordStockTake, StockError, ukToday } from "./stock/ledger";
import {
  PoError, listPos, getPo, createPo, updateDraft, runAction, receiveGoods,
  reorderSuggestions, createFromReorder, onOrderByPart,
} from "./purchasing/po";
import { quoteRate } from "./purchasing/rates";
import { db } from "./db";
import { CURRENCIES, HOME_CURRENCY } from "@shared/constants";
import { previewImport, commitImport, ImportInvalidError } from "./import/commit";
import { ImportFileError } from "./import/parse";
import { buildWorkbook, XLSX_MIME } from "./import/template";
import { exampleRows } from "./import/example";
import { MAX_FILE_BYTES } from "./import/spec";
import { isPrivileged, requirePrivileged, requirePlatformAdmin, requireAdmin, companyOf } from "./auth";
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
  stockMovementSchema, stockTakeSchema,
  poDraftSchema, poActionSchema, goodsReceiptSchema, reorderCreateSchema,
  requestSubmitSchema, requestConvertSchema, requestRejectSchema,
  labourEntrySchema, jobNoteSchema, followUpJobSchema, shiftPatternSchema, absenceSchema,
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

/**
 * Reads the request body as raw bytes for the Excel import only (the global JSON parser
 * keeps its small limit). Oversize uploads get a plain message instead of a generic 413.
 */
const rawXlsx = express.raw({ type: () => true, limit: MAX_FILE_BYTES });
function xlsxBody(req: Request, res: Response, next: NextFunction) {
  rawXlsx(req, res, (err?: any) => {
    if (!err) return next();
    const tooBig = err.status === 413 || err.type === "entity.too.large";
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? "The file is larger than 5 MB." : "The upload couldn't be read." });
  });
}

function sendWorkbook(res: Response, buf: Buffer, filename: string) {
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buf);
}

/** Runs a preview or commit, turning file and validation problems into client errors. */
async function runImport(req: Request, res: Response, fn: typeof previewImport) {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ message: "Choose an .xlsx file to upload." });
  }
  const companyId = companyOf(req);
  const importer = { id: req.user!.id, name: req.user!.name, role: req.user!.role };
  try {
    const result = await fn(body, companyId, importer);
    if (fn === commitImport) {
      const counts = result.summary.map((s) => `${s.key}:+${s.new}/~${s.updated}`).join(" ");
      console.log(`[import] company=${companyId} user=${importer.id} ${counts} stock=${result.stockAdjustments}`);
    }
    res.json(result);
  } catch (err) {
    if (err instanceof ImportFileError) return res.status(400).json({ message: err.message });
    if (err instanceof ImportInvalidError) return res.status(422).json(err.result);
    throw err;
  }
}

// Purchase-order decisions that only Managers/Admins may make.

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
    // Hourly rates are pay information: only Managers/Admins see them.
    res.json(isPrivileged(req.user) ? data : data.map(({ hourlyRate: _rate, ...u }) => u));
  });
  // People management is Admin-only: adding users, changing roles, passwords and PO limits.
  app.post("/api/users", requireAdmin, async (req, res) => {
    const data = parseBody(insertUserSchema, req, res);
    if (!data) return;
    const user = await storage.createUser(companyOf(req), data);
    res.status(201).json(user);
  });
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    const id = parseUserId(req, res);
    if (id === undefined) return;
    const data = parseUpdate(updateUserSchema, req, res);
    if (!data) return;
    const existing = (await storage.getUsers(companyOf(req))).find((u) => u.id === id);
    if (!existing) return res.status(404).json({ message: "User not found" });
    if (existing.role === PLATFORM_ADMIN_ROLE && data.role !== undefined) {
      return res.status(400).json({ message: "The platform admin's role cannot be changed here" });
    }
    // Stops an Admin locking themselves out by demoting their own account.
    if (id === req.user!.id && data.role !== undefined && data.role !== existing.role) {
      return res.status(400).json({ message: "You can't change your own role. Ask another Admin." });
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

  // ===== EXCEL IMPORT (Managers/Admins; docs/data-import-plan.md section 3) =====
  // requirePrivileged runs before the body is read, so other users can't upload 5 MB.
  app.get("/api/import/template", requirePrivileged, async (_req, res) => {
    sendWorkbook(res, await buildWorkbook(), "myCMMS-import-template.xlsx");
  });
  app.get("/api/import/example", requirePrivileged, async (req, res) => {
    sendWorkbook(res, await buildWorkbook(exampleRows(companyOf(req))), "myCMMS-example-food-site.xlsx");
  });
  app.post("/api/import/preview", requirePrivileged, xlsxBody, (req, res) => runImport(req, res, previewImport));
  app.post("/api/import/commit", requirePrivileged, xlsxBody, (req, res) => runImport(req, res, commitImport));

  // ===== JOB RECORDS, SHIFTS AND KPIs (docs/asset-stock-jobs-plan.md 1.2) =====
  const actorOf = (req: Request) => ({ id: req.user!.id, name: req.user!.name, role: req.user!.role });
  const domainErrors = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof JobError || err instanceof ShiftError || err instanceof StockError || err instanceof AuditError) {
        return res.status(err.status).json({ message: err.message });
      }
      throw err;
    }
  };
  const intParam = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : NaN;
  };

  app.get("/api/jobs/:id/record", domainErrors(async (req, res) => {
    res.json(await getJobDetail(companyOf(req), String(req.params.id), actorOf(req)));
  }));
  // Anyone signed in books their own hours on any job, including planned work / PPMs.
  app.post("/api/jobs/:id/labour", domainErrors(async (req, res) => {
    const data = parseBody(labourEntrySchema, req, res);
    if (!data) return;
    res.status(201).json(await addLabour(companyOf(req), String(req.params.id), data, actorOf(req)));
  }));
  app.delete("/api/jobs/:id/labour/:labourId", domainErrors(async (req, res) => {
    const labourId = intParam(req.params.labourId);
    if (Number.isNaN(labourId)) return res.status(400).json({ message: "Invalid entry" });
    await deleteLabour(companyOf(req), String(req.params.id), labourId, actorOf(req));
    res.status(204).end();
  }));
  app.post("/api/jobs/:id/notes", domainErrors(async (req, res) => {
    const data = parseBody(jobNoteSchema, req, res);
    if (!data) return;
    res.status(201).json(await addNote(companyOf(req), String(req.params.id), data, actorOf(req)));
  }));
  app.post("/api/jobs/:id/notes/:noteId/follow-up-job", domainErrors(async (req, res) => {
    const noteId = intParam(req.params.noteId);
    if (Number.isNaN(noteId)) return res.status(400).json({ message: "Invalid note" });
    const data = parseBody(followUpJobSchema, req, res);
    if (!data) return;
    res.status(201).json(await createFollowUpJob(companyOf(req), String(req.params.id), noteId, data, actorOf(req)));
  }));

  // Shift hours and absences: Managers/Admins maintain them; anyone can see their own.
  app.get("/api/users/:id/shifts", domainErrors(async (req, res) => {
    const userId = intParam(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ message: "Invalid user" });
    res.json(await getShifts(companyOf(req), userId, actorOf(req)));
  }));
  app.put("/api/users/:id/shifts", domainErrors(async (req, res) => {
    const userId = intParam(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ message: "Invalid user" });
    const data = parseBody(shiftPatternSchema, req, res);
    if (!data) return;
    res.json(await savePattern(companyOf(req), userId, data, actorOf(req)));
  }));
  app.delete("/api/users/:id/shifts/:patternId", domainErrors(async (req, res) => {
    const userId = intParam(req.params.id), patternId = intParam(req.params.patternId);
    if (Number.isNaN(userId) || Number.isNaN(patternId)) return res.status(400).json({ message: "Invalid request" });
    await deletePattern(companyOf(req), userId, patternId, actorOf(req));
    res.status(204).end();
  }));
  app.post("/api/users/:id/absences", domainErrors(async (req, res) => {
    const userId = intParam(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ message: "Invalid user" });
    const data = parseBody(absenceSchema, req, res);
    if (!data) return;
    res.status(201).json(await addAbsence(companyOf(req), userId, data, actorOf(req)));
  }));
  app.delete("/api/users/:id/absences/:absenceId", domainErrors(async (req, res) => {
    const userId = intParam(req.params.id), absenceId = intParam(req.params.absenceId);
    if (Number.isNaN(userId) || Number.isNaN(absenceId)) return res.status(400).json({ message: "Invalid request" });
    await deleteAbsence(companyOf(req), userId, absenceId, actorOf(req));
    res.status(204).end();
  }));

  app.get("/api/reports/kpis", async (req, res) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const from = String(req.query.from ?? ""), to = String(req.query.to ?? "");
    if (!iso.test(from) || !iso.test(to) || from > to) return res.status(400).json({ message: "Give from and to as YYYY-MM-DD" });
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 731) return res.status(400).json({ message: "The period can be at most 2 years" });
    res.json(await engineeringKpis(companyOf(req), from, to, req.user!.role));
  });

  // ===== CALENDAR: everything the signed-in person can action, by date =====
  app.get("/api/calendar", async (req, res) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!iso.test(from) || !iso.test(to) || from > to) {
      return res.status(400).json({ message: "Give from and to as YYYY-MM-DD" });
    }
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > 100) {
      return res.status(400).json({ message: "The calendar range can be at most 100 days" });
    }
    res.json(await calendarItems(companyOf(req), { id: req.user!.id, name: req.user!.name, role: req.user!.role }, from, to));
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
    const item = await storage.createInventoryItem(companyOf(req), data, { name: req.user!.name });
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
    // The server numbers new jobs (JOB-00001...) unless an ID is given (e.g. by an import).
    const data = parseBody(insertJobSchema.extend({ id: z.string().trim().min(1).max(50).optional() }), req, res);
    if (!data) return;
    const companyId = companyOf(req);
    // Numbering and insert in one transaction, so simultaneous jobs never get the same number.
    const job = await db.transaction(async (tx) => {
      const id = data.id ?? await nextNumber(tx, "jobs", "JOB", companyId);
      const [created] = await tx.insert(jobsTable).values({
        ...data, id, companyId, completedAt: data.status === "Completed" ? new Date() : null,
      }).returning();
      return created;
    });
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
  // Every stock change goes through the ledger (server/stock/ledger.ts): it locks the part,
  // keeps FIFO lots in step and records the cost. Stock can't be edited directly.
  app.post("/api/stock/movements", async (req, res) => {
    const data = parseBody(stockMovementSchema, req, res);
    if (!data) return;
    try {
      res.status(201).json(await recordMovementNow(companyOf(req), data, { name: req.user!.name }));
    } catch (err) {
      if (err instanceof StockError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  });
  app.post("/api/stock/stock-take", async (req, res) => {
    const data = parseBody(stockTakeSchema, req, res);
    if (!data) return;
    try {
      res.json(await recordStockTake(companyOf(req), data.counts, { name: req.user!.name }, data.reference));
    } catch (err) {
      if (err instanceof StockError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  });

  // ===== PURCHASING (docs/asset-stock-jobs-plan.md phase P) =====
  // Status changes only happen through these actions; each checks the rules and who may act.
  const poActor = (req: Request) => ({ id: req.user!.id, name: req.user!.name, role: req.user!.role });
  const poErrors = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof PoError || err instanceof StockError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  };

  app.get("/api/purchase-orders", async (req, res) => {
    res.json(await listPos(companyOf(req)));
  });
  app.get("/api/purchase-orders/:id", poErrors(async (req, res) => {
    res.json(await getPo(companyOf(req), String(req.params.id)));
  }));
  app.post("/api/purchase-orders", poErrors(async (req, res) => {
    const data = parseBody(poDraftSchema, req, res);
    if (!data) return;
    res.status(201).json(await createPo(companyOf(req), data, poActor(req)));
  }));
  app.put("/api/purchase-orders/:id", poErrors(async (req, res) => {
    const data = parseBody(poDraftSchema, req, res);
    if (!data) return;
    res.json(await updateDraft(companyOf(req), String(req.params.id), data, poActor(req)));
  }));
  const PO_ACTIONS = new Set(["submit", "withdraw", "approve", "reject", "recall", "send", "close", "cancel"]);
  app.post("/api/purchase-orders/:id/:action", poErrors(async (req, res) => {
    const action = String(req.params.action);
    if (action === "receipts") {
      const data = parseBody(goodsReceiptSchema, req, res);
      if (!data) return;
      return res.json(await receiveGoods(companyOf(req), String(req.params.id), data, poActor(req)));
    }
    if (!PO_ACTIONS.has(action)) return res.status(404).json({ message: "Unknown action" });
    const data = parseBody(poActionSchema, req, res);
    if (!data) return;
    res.json(await runAction(companyOf(req), String(req.params.id), action as any, data, poActor(req)));
  }));
  app.get("/api/purchasing/reorder", async (req, res) => {
    res.json(await reorderSuggestions(companyOf(req)));
  });
  app.post("/api/purchasing/reorder", poErrors(async (req, res) => {
    const data = parseBody(reorderCreateSchema, req, res);
    if (!data) return;
    res.status(201).json(await createFromReorder(companyOf(req), data.items, poActor(req)));
  }));
  app.get("/api/purchasing/on-order", async (req, res) => {
    res.json(Object.fromEntries(await onOrderByPart(companyOf(req))));
  });
  app.get("/api/exchange-rates/latest", async (req, res) => {
    const currency = String(req.query.currency ?? "").toUpperCase();
    if (!(CURRENCIES as readonly string[]).includes(currency)) return res.status(400).json({ message: "Unknown currency" });
    const quote = await quoteRate(db, currency, ukToday());
    if (!quote) return res.status(404).json({ message: `No exchange rate for ${currency} yet` });
    res.json({ currency, homeCurrency: HOME_CURRENCY, ...quote });
  });

  // ===== ASSET AUDITS =====
  app.get("/api/audits", async (req, res) => {
    const data = await storage.getAssetAudits(companyOf(req));
    res.json(data);
  });
  app.post("/api/audits", async (req, res) => {
    // The server numbers new audits (AUD-00001...) unless an ID is given (e.g. by an import).
    const data = parseBody(insertAssetAuditSchema.extend({ id: z.string().trim().min(1).max(50).optional() }), req, res);
    if (!data) return;
    const companyId = companyOf(req);
    const audit = await db.transaction(async (tx) => {
      const id = data.id ?? await nextNumber(tx, "asset_audits", "AUD", companyId);
      const [created] = await tx.insert(assetAuditsTable).values({ ...data, id, companyId }).returning();
      return created;
    });
    res.status(201).json(audit);
  });
  // ---- Mobile app (/m): the engineer's day, the job timer, scan look-ups.
  app.get("/api/me/today", async (req, res) => { res.json(await myDay(companyOf(req), actorOf(req))); });
  app.get("/api/me/timer", async (req, res) => { res.json(await getTimer(companyOf(req), req.user!.id)); });
  app.post("/api/jobs/:id/timer/start", domainErrors(async (req, res) => {
    res.json(await startTimer(companyOf(req), String(req.params.id), actorOf(req)));
  }));
  app.post("/api/me/timer/pause", domainErrors(async (req, res) => { res.json(await pauseTimer(companyOf(req), actorOf(req))); }));
  app.post("/api/me/timer/stop", domainErrors(async (req, res) => {
    const data = parseBody(timerStopSchema, req, res);
    if (!data) return;
    res.json(await stopTimer(companyOf(req), actorOf(req), data));
  }));
  app.get("/api/lookup", async (req, res) => {
    const code = String(req.query.code ?? "").slice(0, 200);
    res.json(await lookupCode(companyOf(req), code, actorOf(req)));
  });
  app.get("/api/assets/:id/common-parts", async (req, res) => {
    res.json(await commonPartsForAsset(companyOf(req), String(req.params.id)));
  });

  // An area audit: one audit per asset at the location, for one auditor on one date.
  app.post("/api/audits/schedule", domainErrors(async (req, res) => {
    const data = parseBody(scheduleAuditSchema, req, res);
    if (!data) return;
    res.status(201).json(await scheduleAreaAudit(companyOf(req), data, actorOf(req)));
  }));
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
  // Anyone signed in can submit; the server numbers it (REQ-00001) and stamps the time.
  const requestActor = (req: Request) => ({ id: req.user!.id, name: req.user!.name, role: req.user!.role });
  const requestErrors = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof RequestError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  };
  app.post("/api/maintenance-requests", requestErrors(async (req, res) => {
    const data = parseBody(requestSubmitSchema, req, res);
    if (!data) return;
    res.status(201).json(await submitRequest(companyOf(req), data, requestActor(req)));
  }));
  // Triage (Lead/Manager/Admin): turn into a job, or reject with a reason.
  app.post("/api/maintenance-requests/:id/convert", requestErrors(async (req, res) => {
    const data = parseBody(requestConvertSchema, req, res);
    if (!data) return;
    res.json(await convertRequest(companyOf(req), String(req.params.id), data, requestActor(req)));
  }));
  app.post("/api/maintenance-requests/:id/reject", requestErrors(async (req, res) => {
    const data = parseBody(requestRejectSchema, req, res);
    if (!data) return;
    res.json(await rejectRequest(companyOf(req), String(req.params.id), data.reason, requestActor(req)));
  }));

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
