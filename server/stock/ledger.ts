/**
 * The stock ledger: the only code that changes stock levels (docs/asset-stock-jobs-plan.md 1.1).
 * Every movement runs inside a database transaction, locks the part row, keeps FIFO lots in
 * step with stock on hand, and writes one stock_transactions row with its cost.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { inventory, stockLots, stockTakes, stockTransactions, jobs, assets } from "@shared/schema";
import type { StockMovementInput, StockTransaction } from "@shared/schema";
import { STOCK_IN_TYPES, STOCK_OUT_TYPES, type StockMovementType } from "@shared/constants";
import { allocateFifo, averageUnitCost } from "./fifo";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A problem with the request (not enough stock, unknown part...): shown to the user. */
export class StockError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface Actor { name: string }

const IN = new Set<string>(STOCK_IN_TYPES);
const OUT = new Set<string>(STOCK_OUT_TYPES);
const REPLENISH = new Set<string>(["Stock In", "Purchase Order"]);

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => round2(n).toFixed(2);
const unit4 = (n: number) => (Math.round(n * 10000) / 10000).toFixed(4);

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function newTransactionId(): string {
  return `TXN-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/** Signed change in stock for a movement, checking the sign suits the type. */
function signedQuantity(type: StockMovementType, quantity: number): number {
  if (IN.has(type) || OUT.has(type)) {
    if (quantity <= 0) throw new StockError(`Enter a quantity above 0 for ${type}`);
    return IN.has(type) ? quantity : -quantity;
  }
  return quantity; // adjustment types are already signed
}

async function lockPart(tx: Tx, companyId: number, partId: string) {
  const [part] = await tx.select().from(inventory)
    .where(and(eq(inventory.companyId, companyId), eq(inventory.id, partId)))
    .for("update");
  if (!part) throw new StockError(`Part ${partId} not found`, 404);
  return part;
}

/** Cost per unit for a return against a job: what that job's issues of this part cost. */
async function returnCost(tx: Tx, companyId: number, jobId: string, partId: string, quantity: number) {
  const [row] = await tx.select({
    issued: sql<string>`coalesce(sum(case when ${stockTransactions.type} = 'Job Issue' then -${stockTransactions.quantity} else 0 end), 0)`,
    returned: sql<string>`coalesce(sum(case when ${stockTransactions.type} = 'Return to Stores' then ${stockTransactions.quantity} else 0 end), 0)`,
    issuedValue: sql<string>`coalesce(sum(case when ${stockTransactions.type} = 'Job Issue' then -${stockTransactions.value} else 0 end), 0)`,
  }).from(stockTransactions).where(and(
    eq(stockTransactions.companyId, companyId),
    eq(stockTransactions.jobId, jobId),
    eq(stockTransactions.partId, partId),
  ));
  const issued = Number(row?.issued ?? 0);
  const returned = Number(row?.returned ?? 0);
  if (quantity > issued - returned) {
    throw new StockError(`Only ${issued - returned} of part ${partId} can be returned against job ${jobId}`);
  }
  return issued > 0 ? Number(row.issuedValue) / issued : null;
}

/**
 * Records one stock movement. Must be called inside a transaction.
 * Returns the transaction row written.
 */
export async function recordMovement(tx: Tx, companyId: number, input: StockMovementInput, actor: Actor): Promise<StockTransaction> {
  const type = input.type as StockMovementType;
  const delta = signedQuantity(type, input.quantity);
  const part = await lockPart(tx, companyId, input.partId);

  // Links: a job implies its asset unless one is given.
  let assetId = input.assetId ?? null;
  if (input.jobId) {
    const [job] = await tx.select({ id: jobs.id, assetId: jobs.assetId }).from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, input.jobId)));
    if (!job) throw new StockError(`Job ${input.jobId} not found`, 404);
    assetId = assetId ?? job.assetId ?? null;
  }
  if (assetId) {
    const [asset] = await tx.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.companyId, companyId), eq(assets.id, assetId)));
    if (!asset) throw new StockError(`Asset ${assetId} not found`, 404);
  }

  const newStock = part.stock + delta;
  if (newStock < 0) {
    throw new StockError(`Only ${part.stock} ${part.unit} of ${part.name} in stock`, 409);
  }

  const partCost = part.unitCost === null ? null : Number(part.unitCost);
  const id = newTransactionId();
  let unitCost: number;
  let value: number;

  if (delta > 0) {
    let cost = input.unitCost ?? null;
    if (cost === null && type === "Return to Stores" && input.jobId) {
      cost = await returnCost(tx, companyId, input.jobId, part.id, delta);
    }
    if (cost === null) cost = partCost;
    if (cost === null) {
      const [latest] = await tx.select({ unitCost: stockLots.unitCost }).from(stockLots)
        .where(and(eq(stockLots.companyId, companyId), eq(stockLots.partId, part.id)))
        .orderBy(sql`${stockLots.receivedAt} desc, ${stockLots.id} desc`).limit(1);
      cost = latest ? Number(latest.unitCost) : 0;
    }
    unitCost = cost;
    value = round2(delta * cost);
  } else {
    const open = await tx.select().from(stockLots)
      .where(and(eq(stockLots.companyId, companyId), eq(stockLots.partId, part.id), gt(stockLots.quantityRemaining, 0)))
      .orderBy(asc(stockLots.receivedAt), asc(stockLots.id))
      .for("update");
    const allocation = allocateFifo(
      open.map((l) => ({ id: l.id, quantityRemaining: l.quantityRemaining, unitCost: Number(l.unitCost) })),
      -delta,
      partCost ?? 0,
    );
    for (const take of allocation.takes) {
      await tx.update(stockLots)
        .set({ quantityRemaining: sql`${stockLots.quantityRemaining} - ${take.quantity}` })
        .where(eq(stockLots.id, take.lotId));
    }
    if (allocation.uncovered > 0) {
      console.warn(`[stock] part ${part.id} (company ${companyId}): ${allocation.uncovered} unit(s) issued without a cost lot`);
    }
    unitCost = averageUnitCost(allocation.cost, -delta);
    value = -allocation.cost;
  }

  const today = ukToday();
  await tx.update(inventory).set({
    stock: newStock,
    ...(type === "Job Issue" ? { lastUsed: today } : {}),
    ...(REPLENISH.has(type) ? { lastReplenished: today } : {}),
  }).where(and(eq(inventory.companyId, companyId), eq(inventory.id, part.id)));

  const [txn] = await tx.insert(stockTransactions).values({
    companyId,
    id,
    date: new Date().toISOString(),
    partId: part.id,
    partName: part.name,
    type,
    quantity: delta,
    userId: actor.name,
    reference: input.reference ?? null,
    unitCost: unit4(unitCost),
    value: money(value),
    balanceAfter: newStock,
    jobId: input.jobId ?? null,
    assetId,
    poId: input.poId ?? null,
  }).returning();

  if (delta > 0) {
    await tx.insert(stockLots).values({
      companyId,
      partId: part.id,
      quantityReceived: delta,
      quantityRemaining: delta,
      unitCost: unit4(unitCost),
      transactionId: id,
    });
  }
  return txn;
}

/** Records a movement in its own transaction (for single API calls). */
export function recordMovementNow(companyId: number, input: StockMovementInput, actor: Actor) {
  return db.transaction((tx) => recordMovement(tx, companyId, input, actor));
}

/**
 * Sets a part's stock to `target` with one movement of the given type (used by the import).
 * Does nothing if stock is already at the target.
 */
export async function setStockTo(
  tx: Tx, companyId: number, partId: string, target: number,
  type: "Stock In" | "Import Adjustment" | "Stock Take Adjustment", actor: Actor, reference: string,
): Promise<StockTransaction | null> {
  const part = await lockPart(tx, companyId, partId);
  const diff = target - part.stock;
  if (diff === 0) return null;
  const movementType = type === "Stock In" && diff < 0 ? "Import Adjustment" : type;
  return recordMovement(tx, companyId, { partId, type: movementType, quantity: diff, reference }, actor);
}

export interface StockTakeResult {
  counted: number;
  adjusted: number;
  /** Net value change of the adjustments, £. */
  valueChange: number;
}

/** Records a stock take: one stock_takes row per part, and an adjustment for each difference. */
export async function recordStockTake(
  companyId: number, counts: { partId: string; counted: number; reason?: string | null }[], actor: Actor, reference?: string | null,
): Promise<StockTakeResult> {
  const seen = new Set<string>();
  for (const c of counts) {
    if (seen.has(c.partId)) throw new StockError(`Part ${c.partId} is counted twice`);
    seen.add(c.partId);
  }
  return db.transaction(async (tx) => {
    let adjusted = 0;
    let valueChange = 0;
    const today = ukToday();
    for (const c of counts) {
      const part = await lockPart(tx, companyId, c.partId);
      await tx.insert(stockTakes).values({ companyId, partId: part.id, expected: part.stock, counted: c.counted, userName: actor.name });
      if (c.counted !== part.stock) {
        const txn = await recordMovement(tx, companyId, {
          partId: part.id, type: "Stock Take Adjustment", quantity: c.counted - part.stock,
          reference: [reference || "Stock take", c.reason].filter(Boolean).join(": "),
        }, actor);
        adjusted++;
        valueChange += Number(txn.value ?? 0);
      }
      await tx.update(inventory).set({ lastStockTaken: today })
        .where(and(eq(inventory.companyId, companyId), eq(inventory.id, part.id)));
    }
    return { counted: counts.length, adjusted, valueChange: round2(valueChange) };
  });
}
