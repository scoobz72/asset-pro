/**
 * Purchase orders: drafting, approval, sending, goods receipt and reorder
 * (docs/asset-stock-jobs-plan.md phase P). Every change runs in a transaction with the PO
 * row locked, and is written to the PO's event log.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  purchaseOrders, purchaseOrderLines, goodsReceipts, goodsReceiptLines, poEvents,
  suppliers, inventory, jobs, users,
  type PoDraftInput, type GoodsReceiptInput, type PurchaseOrder, type PurchaseOrderLine,
} from "@shared/schema";
import { HOME_CURRENCY, PO_OPEN_STATUSES, formatMoney } from "@shared/constants";
import { recordMovement, ukToday, type Tx } from "../stock/ledger";
import { quoteRate, toHome, type RateQuote } from "./rates";
import {
  checkTransition, checkApprover, canManage, isPrivilegedRole, outstanding, lineDeliveryStatus,
  statusAfterReceipt, suggestedQuantity, poTotal, round2, type PoAction, type PoActor,
} from "./rules";

/** A problem with the request, shown to the user. */
export class PoError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const NUMBERING_LOCK = 515151;

async function lockPo(tx: Tx, companyId: number, id: string): Promise<PurchaseOrder> {
  const [po] = await tx.select().from(purchaseOrders)
    .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)))
    .for("update");
  if (!po) throw new PoError(`PO ${id} not found`, 404);
  return po;
}

function allow(po: PurchaseOrder, action: PoAction) {
  const problem = checkTransition(po.status, action);
  if (problem) throw new PoError(problem, 409);
}

function mustManage(po: PurchaseOrder, actor: PoActor) {
  if (!canManage(actor, po.createdById)) {
    throw new PoError("Only the person who raised this PO, or a Manager/Admin, can do that.", 403);
  }
}

async function logEvent(tx: Tx, companyId: number, poId: string, actor: PoActor, action: string, note?: string | null) {
  await tx.insert(poEvents).values({ companyId, poId, userName: actor.name, action, note: note ?? null });
}

async function nextPoNumber(tx: Tx, companyId: number): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(${NUMBERING_LOCK}, ${companyId})`);
  const [row] = await tx.select({
    max: sql<number>`coalesce(max((substring(${purchaseOrders.id} from '^PO-(\\d+)$'))::int), 0)`,
  }).from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
  return `PO-${String(Number(row?.max ?? 0) + 1).padStart(5, "0")}`;
}

function rateText(currency: string, q: RateQuote): string {
  if (q.source === "Home") return `${currency} (home currency)`;
  return `1 ${currency} = ${formatMoney(q.rate, HOME_CURRENCY, 4)} (${q.source}${q.source === "ECB" ? `, ${q.rateDate}` : ""})`;
}

/** Rate for today: a Manager's override, or the latest ECB rate. */
async function resolveRate(tx: Tx, currency: string, actor: PoActor, override?: number | null): Promise<RateQuote> {
  const today = ukToday();
  if (currency === HOME_CURRENCY) return { rate: 1, rateDate: today, source: "Home" };
  if (override) {
    if (!isPrivilegedRole(actor.role)) throw new PoError("Only a Manager or Admin can enter an exchange rate.", 403);
    return { rate: override, rateDate: today, source: "Manual" };
  }
  const q = await quoteRate(tx, currency, today);
  if (!q) throw new PoError(`No exchange rate for ${currency} is available yet. A Manager or Admin can enter one.`, 409);
  return q;
}

// ------------------------------------------------------------------ drafting

async function validateLines(tx: Tx, companyId: number, lines: PoDraftInput["lines"]) {
  const partIds = Array.from(new Set(lines.map((l) => l.partId).filter((p): p is string => !!p)));
  const parts = partIds.length === 0 ? [] : await tx.select({ id: inventory.id, name: inventory.name }).from(inventory)
    .where(and(eq(inventory.companyId, companyId), inArray(inventory.id, partIds)));
  const names = new Map(parts.map((p) => [p.id, p.name]));
  return lines.map((l, i) => {
    if (l.partId && !names.has(l.partId)) throw new PoError(`Line ${i + 1}: part ${l.partId} not found`);
    const description = (l.description ?? "").trim() || (l.partId ? names.get(l.partId)! : "");
    if (!description) throw new PoError(`Line ${i + 1}: enter a description for a non-stock item`);
    return { lineNo: i + 1, partId: l.partId ?? null, description, quantity: l.quantity, unitPrice: Number(l.unitPrice) };
  });
}

async function draftFields(tx: Tx, companyId: number, input: PoDraftInput) {
  const [supplier] = await tx.select().from(suppliers)
    .where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, input.supplierId)));
  if (!supplier) throw new PoError(`Supplier ${input.supplierId} not found`, 404);
  if (input.jobId) {
    const [job] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.id, input.jobId)));
    if (!job) throw new PoError(`Job ${input.jobId} not found`, 404);
  }
  const lines = await validateLines(tx, companyId, input.lines);
  return {
    supplier,
    lines,
    fields: {
      supplierId: supplier.id,
      vendor: supplier.name,
      currency: input.currency ?? supplier.currency ?? HOME_CURRENCY,
      jobId: input.jobId ?? null,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      total: poTotal(lines).toFixed(2),
      items: lines.length,
    },
  };
}

async function writeLines(tx: Tx, companyId: number, poId: string, lines: Awaited<ReturnType<typeof validateLines>>) {
  await tx.delete(purchaseOrderLines).where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, poId)));
  await tx.insert(purchaseOrderLines).values(lines.map((l) => ({
    companyId, poId, lineNo: l.lineNo, partId: l.partId, description: l.description, quantity: l.quantity,
    unitPrice: l.unitPrice.toFixed(4),
  })));
}

async function createInTx(tx: Tx, companyId: number, input: PoDraftInput, actor: PoActor, note?: string) {
  const { fields, lines } = await draftFields(tx, companyId, input);
  const id = await nextPoNumber(tx, companyId);
  await tx.insert(purchaseOrders).values({
    companyId, id, ...fields, status: "Draft", requestedBy: actor.name, createdById: actor.id, date: ukToday(),
  });
  await writeLines(tx, companyId, id, lines);
  await logEvent(tx, companyId, id, actor, "Created", note ?? `${lines.length} line(s), ${formatMoney(fields.total, fields.currency)}`);
  return id;
}

export function createPo(companyId: number, input: PoDraftInput, actor: PoActor) {
  return db.transaction(async (tx) => getPoIn(tx, companyId, await createInTx(tx, companyId, input, actor)));
}

export function updateDraft(companyId: number, id: string, input: PoDraftInput, actor: PoActor) {
  return db.transaction(async (tx) => {
    const po = await lockPo(tx, companyId, id);
    allow(po, "edit");
    mustManage(po, actor);
    const { fields, lines } = await draftFields(tx, companyId, input);
    await tx.update(purchaseOrders).set({ ...fields, exchangeRate: null, rateDate: null, rateSource: null, totalHome: null })
      .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)));
    await writeLines(tx, companyId, id, lines);
    await logEvent(tx, companyId, id, actor, "Edited", `${lines.length} line(s), ${formatMoney(fields.total, fields.currency)}`);
    return getPoIn(tx, companyId, id);
  });
}

// ------------------------------------------------------------------ approval flow

export interface ActionInput { note?: string | null; exchangeRate?: number | null }

export function runAction(companyId: number, id: string, action: Exclude<PoAction, "edit" | "receive">, input: ActionInput, actor: PoActor) {
  return db.transaction(async (tx) => {
    const po = await lockPo(tx, companyId, id);
    allow(po, action);
    const where = and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id));
    const note = input.note?.trim() || null;

    switch (action) {
      case "submit": {
        mustManage(po, actor);
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(purchaseOrderLines)
          .where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, id)));
        if (Number(n) === 0) throw new PoError("Add at least one line before submitting.");
        const q = await resolveRate(tx, po.currency, actor, input.exchangeRate);
        const totalHome = round2(Number(po.total) * q.rate);
        await tx.update(purchaseOrders).set({
          status: "Pending Approval", submittedAt: new Date(), exchangeRate: q.rate.toFixed(8), rateDate: q.rateDate,
          rateSource: q.source, totalHome: totalHome.toFixed(2), rejectionReason: null, approvedById: null, approvedAt: null,
        }).where(where);
        const conversion = po.currency === HOME_CURRENCY ? "" : ` ≈ ${formatMoney(totalHome, HOME_CURRENCY)} at ${rateText(po.currency, q)}`;
        await logEvent(tx, companyId, id, actor, "Submitted for approval", `${formatMoney(po.total, po.currency)}${conversion}${note ? ` · ${note}` : ""}`);
        break;
      }
      case "withdraw":
        mustManage(po, actor);
        await tx.update(purchaseOrders).set({ status: "Draft", submittedAt: null }).where(where);
        await logEvent(tx, companyId, id, actor, "Withdrawn", note);
        break;
      case "approve":
      case "reject": {
        const [approver] = await tx.select({ limit: users.poApprovalLimit }).from(users)
          .where(and(eq(users.companyId, companyId), eq(users.id, actor.id)));
        const problem = checkApprover({ approverId: actor.id, approverRole: actor.role, approverLimit: approver?.limit ?? null, createdById: po.createdById, totalHome: po.totalHome });
        if (problem) throw new PoError(problem, 403);
        if (action === "approve") {
          await tx.update(purchaseOrders).set({ status: "Approved", approvedById: actor.id, approvedAt: new Date() }).where(where);
          await logEvent(tx, companyId, id, actor, "Approved", note ?? formatMoney(po.totalHome, HOME_CURRENCY));
        } else {
          if (!note) throw new PoError("Give a reason for rejecting the PO.");
          await tx.update(purchaseOrders).set({ status: "Rejected", rejectionReason: note }).where(where);
          await logEvent(tx, companyId, id, actor, "Rejected", note);
        }
        break;
      }
      case "recall":
        if (!canManage(actor, po.createdById) && po.approvedById !== actor.id) {
          throw new PoError("Only the person who raised or approved this PO, or a Manager/Admin, can recall it.", 403);
        }
        await tx.update(purchaseOrders).set({
          status: "Draft", approvedById: null, approvedAt: null, submittedAt: null,
          exchangeRate: null, rateDate: null, rateSource: null, totalHome: null,
        }).where(where);
        await logEvent(tx, companyId, id, actor, "Recalled (approval cleared)", note);
        break;
      case "send":
        mustManage(po, actor);
        await tx.update(purchaseOrders).set({ status: "Sent", sentById: actor.id, sentAt: new Date() }).where(where);
        await logEvent(tx, companyId, id, actor, "Sent to supplier", note);
        break;
      case "close": {
        if (!isPrivilegedRole(actor.role)) throw new PoError("Only a Manager or Admin can close a PO short.", 403);
        await tx.update(purchaseOrderLines).set({
          quantityCancelled: sql`${purchaseOrderLines.quantity} - ${purchaseOrderLines.quantityReceived}`,
        }).where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, id)));
        await tx.update(purchaseOrders).set({ status: "Closed" }).where(where);
        await logEvent(tx, companyId, id, actor, "Closed short (outstanding quantities cancelled)", note);
        break;
      }
      case "cancel": {
        mustManage(po, actor);
        if (!note) throw new PoError("Give a reason for cancelling the PO.");
        await tx.update(purchaseOrderLines).set({ quantityCancelled: sql`${purchaseOrderLines.quantity}` })
          .where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, id)));
        await tx.update(purchaseOrders).set({ status: "Cancelled" }).where(where);
        await logEvent(tx, companyId, id, actor, "Cancelled", note);
        break;
      }
    }
    return getPoIn(tx, companyId, id);
  });
}

// ------------------------------------------------------------------ goods receipt

export function receiveGoods(companyId: number, id: string, input: GoodsReceiptInput, actor: PoActor) {
  return db.transaction(async (tx) => {
    const po = await lockPo(tx, companyId, id);
    allow(po, "receive");
    const lines = await tx.select().from(purchaseOrderLines)
      .where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, id)))
      .orderBy(asc(purchaseOrderLines.lineNo))
      .for("update");
    const byId = new Map(lines.map((l) => [l.id, l]));
    const seen = new Set<number>();
    for (const r of input.lines) {
      const line = byId.get(r.lineId);
      if (!line) throw new PoError(`Line ${r.lineId} isn't on ${id}`);
      if (seen.has(r.lineId)) throw new PoError(`Line ${line.lineNo} is listed twice`);
      seen.add(r.lineId);
      const left = outstanding(line);
      if (r.quantity > left) {
        throw new PoError(`Line ${line.lineNo} (${line.description}): only ${left} outstanding. Receiving more than ordered isn't allowed; amend the PO instead.`);
      }
    }

    // Valued at the rate on the day the goods arrive (stock is held in the home currency).
    const q = await resolveRate(tx, po.currency, actor, input.exchangeRate);
    const deliveryNote = input.deliveryNote?.trim() || null;
    const [receipt] = await tx.insert(goodsReceipts).values({
      companyId, poId: id, receivedBy: actor.name, deliveryNote,
      exchangeRate: q.rate.toFixed(8), rateDate: q.rateDate, rateSource: q.source,
    }).returning();

    const summary: string[] = [];
    for (const r of input.lines) {
      const line = byId.get(r.lineId)!;
      let transactionId: string | null = null;
      if (line.partId) {
        const unitPrice = Number(line.unitPrice);
        const txn = await recordMovement(tx, companyId, {
          partId: line.partId, type: "Purchase Order", quantity: r.quantity, unitCost: toHome(unitPrice, q.rate),
          poId: id, jobId: po.jobId ?? undefined,
          reference: deliveryNote ? `${id} / ${deliveryNote}` : id,
        }, actor, po.currency === HOME_CURRENCY ? undefined : { currency: po.currency, originalUnitCost: unitPrice, exchangeRate: q.rate });
        transactionId = txn.id;
      }
      await tx.insert(goodsReceiptLines).values({ companyId, receiptId: receipt.id, poLineId: line.id, quantity: r.quantity, transactionId });
      line.quantityReceived += r.quantity;
      await tx.update(purchaseOrderLines).set({ quantityReceived: line.quantityReceived }).where(eq(purchaseOrderLines.id, line.id));
      summary.push(`line ${line.lineNo}: ${r.quantity}`);
    }

    const status = statusAfterReceipt(lines);
    await tx.update(purchaseOrders).set({ status })
      .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)));
    const rate = po.currency === HOME_CURRENCY ? "" : ` · valued at ${rateText(po.currency, q)}`;
    await logEvent(tx, companyId, id, actor, status === "Received" ? "Goods received (complete)" : "Goods received (part)",
      `${summary.join(", ")}${deliveryNote ? ` · delivery note ${deliveryNote}` : ""}${rate}`);
    return getPoIn(tx, companyId, id);
  });
}

// ------------------------------------------------------------------ reading

async function getPoIn(q: typeof db | Tx, companyId: number, id: string) {
  const [po] = await q.select().from(purchaseOrders).where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.id, id)));
  if (!po) throw new PoError(`PO ${id} not found`, 404);
  const lines = await q.select().from(purchaseOrderLines)
    .where(and(eq(purchaseOrderLines.companyId, companyId), eq(purchaseOrderLines.poId, id)))
    .orderBy(asc(purchaseOrderLines.lineNo));
  const receipts = await q.select().from(goodsReceipts)
    .where(and(eq(goodsReceipts.companyId, companyId), eq(goodsReceipts.poId, id)))
    .orderBy(asc(goodsReceipts.receivedAt));
  const receiptLines = receipts.length === 0 ? [] : await q.select().from(goodsReceiptLines)
    .where(inArray(goodsReceiptLines.receiptId, receipts.map((r) => r.id)));
  const events = await q.select().from(poEvents)
    .where(and(eq(poEvents.companyId, companyId), eq(poEvents.poId, id)))
    .orderBy(asc(poEvents.at), asc(poEvents.id));
  const people = await q.select({ id: users.id, name: users.name }).from(users).where(eq(users.companyId, companyId));
  const nameOf = (uid: number | null) => (uid === null ? null : people.find((p) => p.id === uid)?.name ?? null);
  return {
    ...po,
    homeCurrency: HOME_CURRENCY,
    createdByName: nameOf(po.createdById),
    approvedByName: nameOf(po.approvedById),
    sentByName: nameOf(po.sentById),
    lines: lines.map((l) => ({ ...l, outstanding: outstanding(l), deliveryStatus: lineDeliveryStatus(l) })),
    receipts: receipts.map((r) => ({ ...r, lines: receiptLines.filter((rl) => rl.receiptId === r.id) })),
    events,
  };
}

export function getPo(companyId: number, id: string) {
  return getPoIn(db, companyId, id);
}

/** All POs with delivery progress, newest first. */
export async function listPos(companyId: number) {
  const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
  const progress = await db.select({
    poId: purchaseOrderLines.poId,
    ordered: sql<number>`sum(${purchaseOrderLines.quantity})::int`,
    received: sql<number>`sum(${purchaseOrderLines.quantityReceived})::int`,
    cancelled: sql<number>`sum(${purchaseOrderLines.quantityCancelled})::int`,
  }).from(purchaseOrderLines).where(eq(purchaseOrderLines.companyId, companyId)).groupBy(purchaseOrderLines.poId);
  const byPo = new Map(progress.map((p) => [p.poId, p]));
  return pos
    .map((po) => ({ ...po, homeCurrency: HOME_CURRENCY, ordered: byPo.get(po.id)?.ordered ?? 0, received: byPo.get(po.id)?.received ?? 0, cancelled: byPo.get(po.id)?.cancelled ?? 0 }))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) || b.id.localeCompare(a.id));
}

/** Quantity on order per part: outstanding on POs that are still open. */
export async function onOrderByPart(companyId: number): Promise<Map<string, number>> {
  const rows = await db.select({
    partId: purchaseOrderLines.partId,
    qty: sql<number>`sum(${purchaseOrderLines.quantity} - ${purchaseOrderLines.quantityReceived} - ${purchaseOrderLines.quantityCancelled})::int`,
  }).from(purchaseOrderLines)
    .innerJoin(purchaseOrders, and(eq(purchaseOrders.companyId, purchaseOrderLines.companyId), eq(purchaseOrders.id, purchaseOrderLines.poId)))
    .where(and(eq(purchaseOrderLines.companyId, companyId), inArray(purchaseOrders.status, [...PO_OPEN_STATUSES]), sql`${purchaseOrderLines.partId} is not null`))
    .groupBy(purchaseOrderLines.partId);
  return new Map(rows.filter((r) => r.partId).map((r) => [r.partId!, Number(r.qty)]));
}

// ------------------------------------------------------------------ reorder

export async function reorderSuggestions(companyId: number) {
  const onOrder = await onOrderByPart(companyId);
  const parts = await db.select().from(inventory).where(eq(inventory.companyId, companyId));
  const supplierRows = await db.select().from(suppliers).where(eq(suppliers.companyId, companyId));
  const supplierById = new Map(supplierRows.map((s) => [s.id, s]));
  const today = ukToday();
  const rateCache = new Map<string, RateQuote | null>();
  const out = [];
  for (const p of parts) {
    const ordered = onOrder.get(p.id) ?? 0;
    if (p.minStock <= 0 || p.stock + ordered > p.minStock) continue;
    const supplier = p.primarySupplierId ? supplierById.get(p.primarySupplierId) : undefined;
    const currency = supplier?.currency ?? HOME_CURRENCY;
    if (!rateCache.has(currency)) rateCache.set(currency, await quoteRate(db, currency, today));
    const q = rateCache.get(currency);
    const homeCost = p.unitCost === null ? null : Number(p.unitCost);
    out.push({
      partId: p.id, name: p.name, category: p.category, unit: p.unit,
      stock: p.stock, onOrder: ordered, minStock: p.minStock, reorderQty: p.reorderQty,
      suggestedQty: suggestedQuantity({ stock: p.stock, onOrder: ordered, minStock: p.minStock, reorderQty: p.reorderQty }),
      supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null, currency,
      unitCostHome: homeCost,
      /** Price in the supplier's currency (home cost converted at today's rate), if known. */
      unitPrice: homeCost === null ? null : q ? Math.round((homeCost / q.rate) * 10000) / 10000 : null,
      leadTime: supplier?.leadTimeDays ?? p.leadTime ?? null,
    });
  }
  return out.sort((a, b) => (a.supplierName ?? "~").localeCompare(b.supplierName ?? "~") || a.partId.localeCompare(b.partId));
}

/** Creates one Draft PO per primary supplier from the selected reorder lines. */
export function createFromReorder(companyId: number, items: { partId: string; quantity: number }[], actor: PoActor) {
  return db.transaction(async (tx) => {
    const ids = Array.from(new Set(items.map((i) => i.partId)));
    const parts = await tx.select().from(inventory).where(and(eq(inventory.companyId, companyId), inArray(inventory.id, ids)));
    const byId = new Map(parts.map((p) => [p.id, p]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new PoError(`Part(s) not found: ${missing.join(", ")}`);
    const noSupplier = parts.filter((p) => !p.primarySupplierId).map((p) => p.id);
    if (noSupplier.length) throw new PoError(`Set a primary supplier first for: ${noSupplier.join(", ")}`);

    const groups = new Map<string, { partId: string; quantity: number }[]>();
    for (const item of items) {
      const supplierId = byId.get(item.partId)!.primarySupplierId!;
      if (!groups.has(supplierId)) groups.set(supplierId, []);
      groups.get(supplierId)!.push(item);
    }
    const created: string[] = [];
    const today = ukToday();
    for (const [supplierId, group] of Array.from(groups)) {
      const [supplier] = await tx.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId)));
      const currency = supplier?.currency ?? HOME_CURRENCY;
      const q = await quoteRate(tx, currency, today);
      const lines = group.map((i) => {
        const cost = byId.get(i.partId)!.unitCost;
        const price = cost === null || !q ? 0 : Math.round((Number(cost) / q.rate) * 10000) / 10000;
        return { partId: i.partId, quantity: i.quantity, unitPrice: price };
      });
      created.push(await createInTx(tx, companyId, { supplierId, currency, lines } as PoDraftInput, actor, `Created from reorder suggestions (${lines.length} line(s))`));
    }
    return { created };
  });
}

export type PoDetail = Awaited<ReturnType<typeof getPo>>;
export type PoLineView = PurchaseOrderLine & { outstanding: number; deliveryStatus: string };
