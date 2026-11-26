/**
 * Stock ledger tests.
 *  - FIFO allocation: pure, always runs.
 *  - Ledger against the real database: runs only when DATABASE_URL is set. Everything
 *    happens inside one transaction that is always rolled back, using a throwaway company,
 *    so it is safe to run against the live database.
 * Run with: npm run test:ledger
 */
import assert from "node:assert/strict";
import test from "node:test";
import { allocateFifo, averageUnitCost } from "../server/stock/fifo";

test("FIFO takes the oldest lots first and costs them correctly", () => {
  const lots = [
    { id: 1, quantityRemaining: 2, unitCost: 10 },
    { id: 2, quantityRemaining: 0, unitCost: 99 },
    { id: 3, quantityRemaining: 5, unitCost: 12.5 },
  ];
  const a = allocateFifo(lots, 4, 0);
  assert.deepEqual(a.takes, [{ lotId: 1, quantity: 2, unitCost: 10 }, { lotId: 3, quantity: 2, unitCost: 12.5 }]);
  assert.equal(a.cost, 45);
  assert.equal(a.uncovered, 0);
  assert.equal(averageUnitCost(a.cost, 4), 11.25);
});

test("FIFO costs units without lots at the fallback cost", () => {
  const a = allocateFifo([{ id: 1, quantityRemaining: 1, unitCost: 3 }], 3, 2);
  assert.equal(a.uncovered, 2);
  assert.equal(a.cost, 7);
  assert.throws(() => allocateFifo([], 0, 1));
});

const ROLLBACK = new Error("rollback");

test("ledger: receipts, FIFO issues, returns, stock takes and limits (rolled back)", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, async () => {
  const { db, pool } = await import("../server/db");
  const { companies, inventory, jobs, assets, stockLots, stockTransactions } = await import("../shared/schema");
  const { recordMovement, setStockTo, StockError } = await import("../server/stock/ledger");
  const { and, eq } = await import("drizzle-orm");
  const actor = { name: "Ledger test" };

  try {
    await db.transaction(async (tx) => {
      const [company] = await tx.insert(companies).values({ name: `Ledger test ${Date.now()}` }).returning();
      const c = company.id;
      await tx.insert(inventory).values({ companyId: c, id: "P1", name: "Bearing", category: "Bearings", unit: "pcs", stock: 0, unitCost: "5.00" });
      await tx.insert(assets).values({ companyId: c, id: "A1", name: "Press" });
      await tx.insert(jobs).values({ companyId: c, id: "J1", title: "Fix press", assetId: "A1" });
      const stock = async () => (await tx.select().from(inventory).where(and(eq(inventory.companyId, c), eq(inventory.id, "P1"))))[0].stock;

      // Two receipts at different costs.
      await recordMovement(tx, c, { partId: "P1", type: "Stock In", quantity: 2, unitCost: 10 }, actor);
      await recordMovement(tx, c, { partId: "P1", type: "Purchase Order", quantity: 3, unitCost: 20 }, actor);
      assert.equal(await stock(), 5);

      // Issue 3 to the job: 2 @ £10 + 1 @ £20 = £40; asset taken from the job.
      const issue = await recordMovement(tx, c, { partId: "P1", type: "Job Issue", quantity: 3, jobId: "J1" }, actor);
      assert.equal(issue.quantity, -3);
      assert.equal(Number(issue.value), -40);
      assert.equal(issue.assetId, "A1");
      assert.equal(issue.balanceAfter, 2);
      const lots = await tx.select().from(stockLots).where(eq(stockLots.companyId, c));
      assert.deepEqual(lots.map((l) => l.quantityRemaining).sort(), [0, 2]);

      // Return 1 against the job at what the job paid on average (£40 / 3).
      const ret = await recordMovement(tx, c, { partId: "P1", type: "Return to Stores", quantity: 1, jobId: "J1" }, actor);
      assert.equal(Number(ret.value), 13.33);
      await assert.rejects(
        recordMovement(tx, c, { partId: "P1", type: "Return to Stores", quantity: 3, jobId: "J1" }, actor),
        StockError, "can't return more than was issued",
      );

      // Can't go below zero; out types need a positive quantity.
      await assert.rejects(recordMovement(tx, c, { partId: "P1", type: "Stock Out - Damaged", quantity: 99 }, actor), /Only 3 pcs/);
      await assert.rejects(recordMovement(tx, c, { partId: "P1", type: "Job Issue", quantity: -1 }, actor), /above 0/);

      // Stock take style "set to": 3 -> 1 consumes the oldest lots.
      const adj = await setStockTo(tx, c, "P1", 1, "Stock Take Adjustment", actor, "count");
      assert.equal(adj!.quantity, -2);
      assert.equal(await stock(), 1);
      assert.equal(await setStockTo(tx, c, "P1", 1, "Import Adjustment", actor, "same"), null);

      // Lots always add up to stock on hand.
      const open = await tx.select().from(stockLots).where(eq(stockLots.companyId, c));
      assert.equal(open.reduce((n, l) => n + l.quantityRemaining, 0), await stock());

      // Another company's job can't be used.
      await assert.rejects(recordMovement(tx, c, { partId: "P1", type: "Job Issue", quantity: 1, jobId: "NOPE" }, actor), /Job NOPE not found/);
      const txns = await tx.select().from(stockTransactions).where(eq(stockTransactions.companyId, c));
      assert.equal(txns.length, 5);
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  } finally {
    await pool.end();
  }
});
