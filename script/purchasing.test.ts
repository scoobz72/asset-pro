/**
 * Purchasing tests.
 *  - Rules and exchange-rate maths: pure, always run.
 *  - Full PO lifecycle against the real database: only when DATABASE_URL is set. It uses a
 *    throwaway company and deletes everything it created at the end, pass or fail.
 * Run with: npm run test:purchasing
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseEcbXml, crossRate, toHome } from "../server/purchasing/fx";
import {
  checkTransition, checkApprover, lineDeliveryStatus, statusAfterReceipt, suggestedQuantity, poTotal, canManage,
} from "../server/purchasing/rules";

const ECB_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time='2026-11-26'>
      <Cube currency='USD' rate='1.0566'/>
      <Cube currency='GBP' rate='0.83305'/>
    </Cube>
    <Cube time='2026-11-25'>
      <Cube currency='USD' rate='1.0500'/>
      <Cube currency='GBP' rate='0.83000'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

test("ECB feed is parsed, with EUR added at 1 for each day", () => {
  const rates = parseEcbXml(ECB_SAMPLE);
  assert.equal(rates.length, 6);
  assert.deepEqual(rates.find((r) => r.date === "2026-11-26" && r.currency === "GBP"), { date: "2026-11-26", currency: "GBP", perEur: 0.83305 });
  assert.ok(rates.some((r) => r.date === "2026-11-25" && r.currency === "EUR" && r.perEur === 1));
});

test("cross rates convert to GBP correctly", () => {
  // 1 EUR = 0.83305 GBP; 1 USD = 0.83305 / 1.0566 GBP
  assert.equal(crossRate(1, 0.83305), 0.83305);
  assert.equal(crossRate(1.0566, 0.83305), 0.78842514);
  assert.equal(toHome(12.4, 0.83305), 10.3298);
});

test("status flow: allowed and refused actions", () => {
  assert.equal(checkTransition("Draft", "submit"), null);
  assert.equal(checkTransition("Approved", "recall"), null);
  assert.match(checkTransition("Sent", "recall")!, /already been sent/);
  assert.match(checkTransition("Partially Received", "recall")!, /already been sent/);
  assert.match(checkTransition("Pending Approval", "edit")!, /can't be edited/);
  assert.match(checkTransition("Received", "cancel")!, /can't be cancelled/);
  assert.equal(checkTransition("Sent", "receive"), null);
  assert.match(checkTransition("Approved", "receive")!, /can't be received/);
});

test("approval: limits, no self-approval, no rights", () => {
  const base = { approverId: 2, createdById: 1, totalHome: "1500.00" };
  assert.equal(checkApprover({ ...base, approverLimit: "2000.00" }), null);
  assert.equal(checkApprover({ ...base, approverLimit: "1500.00" }), null, "a limit equal to the total is enough");
  assert.match(checkApprover({ ...base, approverLimit: "1000.00" })!, /your approval limit is £1000\.00 GBP/);
  assert.match(checkApprover({ ...base, approverLimit: null })!, /don't have approval rights/);
  assert.match(checkApprover({ ...base, approverId: 1, approverLimit: "999999" })!, /PO you raised/);
  assert.equal(canManage({ id: 5, name: "x", role: "Technician" }, 5), true);
  assert.equal(canManage({ id: 6, name: "x", role: "Technician" }, 5), false);
  assert.equal(canManage({ id: 6, name: "x", role: "Manager" }, 5), true);
});

test("delivery status per line and overall", () => {
  assert.equal(lineDeliveryStatus({ quantity: 5, quantityReceived: 0, quantityCancelled: 0 }), "Not received");
  assert.equal(lineDeliveryStatus({ quantity: 5, quantityReceived: 2, quantityCancelled: 0 }), "Part received");
  assert.equal(lineDeliveryStatus({ quantity: 5, quantityReceived: 5, quantityCancelled: 0 }), "Received");
  assert.equal(lineDeliveryStatus({ quantity: 5, quantityReceived: 2, quantityCancelled: 3 }), "Closed short");
  assert.equal(lineDeliveryStatus({ quantity: 5, quantityReceived: 0, quantityCancelled: 5 }), "Cancelled");
  assert.equal(statusAfterReceipt([{ quantity: 2, quantityReceived: 2, quantityCancelled: 0 }, { quantity: 3, quantityReceived: 1, quantityCancelled: 0 }]), "Partially Received");
  assert.equal(statusAfterReceipt([{ quantity: 2, quantityReceived: 2, quantityCancelled: 0 }]), "Received");
});

test("reorder quantity and PO totals", () => {
  assert.equal(suggestedQuantity({ stock: 1, onOrder: 0, minStock: 4, reorderQty: 10 }), 10);
  assert.equal(suggestedQuantity({ stock: 1, onOrder: 1, minStock: 4, reorderQty: null }), 3);
  assert.equal(poTotal([{ quantity: 3, unitPrice: 1.115 }, { quantity: 1, unitPrice: 10 }]), 13.35);
});

test("PO lifecycle in a foreign currency, end to end (throwaway company, deleted afterwards)", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, async () => {
  const { db, pool } = await import("../server/db");
  const s = await import("../shared/schema");
  const po = await import("../server/purchasing/po");
  const { and, eq, inArray } = await import("drizzle-orm");

  const [company] = await db.insert(s.companies).values({ name: `PO test ${Date.now()} (safe to delete)` }).returning();
  const c = company.id;
  try {
    const [buyer] = await db.insert(s.users).values({ companyId: c, name: "Buyer", role: "Technician", poApprovalLimit: "100.00" }).returning();
    const [boss] = await db.insert(s.users).values({ companyId: c, name: "Boss", role: "Manager", poApprovalLimit: "999999999999.99" }).returning();
    const [boss2] = await db.insert(s.users).values({ companyId: c, name: "Boss 2", role: "Admin", poApprovalLimit: "999999999999.99" }).returning();
    const [small] = await db.insert(s.users).values({ companyId: c, name: "Small", role: "Lead", poApprovalLimit: "50.00" }).returning();
    await db.insert(s.suppliers).values({ companyId: c, id: "SUP-DE", name: "German OEM", currency: "EUR" });
    await db.insert(s.inventory).values({ companyId: c, id: "P1", name: "Seal", category: "Seals", unit: "pcs", stock: 0, minStock: 5, reorderQty: 10, primarySupplierId: "SUP-DE" });
    const B = { id: buyer.id, name: "Buyer", role: "Technician" };
    const M = { id: boss.id, name: "Boss", role: "Manager" };
    const M2 = { id: boss2.id, name: "Boss 2", role: "Admin" };
    const L = { id: small.id, name: "Small", role: "Lead" };
    const RATE = 0.85; // fixed by a manager, so the test doesn't depend on today's ECB rate

    // Reorder creates a draft in the supplier's currency.
    const suggestions = await po.reorderSuggestions(c);
    assert.equal(suggestions.find((x) => x.partId === "P1")?.suggestedQty, 10);
    const { created } = await po.createFromReorder(c, [{ partId: "P1", quantity: 10 }], B);
    assert.equal(created.length, 1);
    const id = created[0];
    let d = await po.updateDraft(c, id, { supplierId: "SUP-DE", lines: [{ partId: "P1", quantity: 10, unitPrice: 20 }] } as any, B);
    assert.equal(d.currency, "EUR");
    assert.equal(Number(d.total), 200);

    // Only a Manager/Admin may override the rate; submitting fixes it: 200 EUR -> 170 GBP.
    await assert.rejects(po.runAction(c, id, "submit", { exchangeRate: RATE }, B), /Only a Manager or Admin/);
    d = await po.runAction(c, id, "submit", { exchangeRate: RATE }, M);
    assert.equal(d.status, "Pending Approval");
    assert.equal(Number(d.totalHome), 170);
    assert.equal(d.rateSource, "Manual");

    // The creator can't approve; nor can someone under the limit; another approver can.
    await assert.rejects(po.runAction(c, id, "approve", {}, B), /PO you raised/);
    await assert.rejects(po.runAction(c, id, "approve", {}, L), /approval limit is £50\.00 GBP/);
    d = await po.runAction(c, id, "approve", {}, M2);
    assert.equal(d.status, "Approved");

    // Recall before sending clears the approval; resubmit, approve again, send.
    d = await po.runAction(c, id, "recall", { note: "price change" }, B);
    assert.equal(d.status, "Draft");
    assert.equal(d.approvedById, null);
    await po.runAction(c, id, "submit", { exchangeRate: RATE }, M);
    await po.runAction(c, id, "approve", {}, M2);
    d = await po.runAction(c, id, "send", {}, B);
    assert.equal(d.status, "Sent");
    await assert.rejects(po.runAction(c, id, "recall", {}, M), /already been sent/);

    // Partial delivery, over-receipt refused, then the rest.
    const lineId = d.lines[0].id;
    d = await po.receiveGoods(c, id, { deliveryNote: "DN1", exchangeRate: RATE, lines: [{ lineId, quantity: 4 }] }, M);
    assert.equal(d.status, "Partially Received");
    assert.equal(d.lines[0].deliveryStatus, "Part received");
    await assert.rejects(po.receiveGoods(c, id, { exchangeRate: RATE, lines: [{ lineId, quantity: 7 }] }, M), /only 6 outstanding/);
    d = await po.receiveGoods(c, id, { deliveryNote: "DN2", exchangeRate: RATE, lines: [{ lineId, quantity: 6 }] }, M);
    assert.equal(d.status, "Received");

    // Stock went in at 20 EUR x 0.85 = 17.00 GBP per unit, keeping the original currency.
    const [part] = await db.select().from(s.inventory).where(and(eq(s.inventory.companyId, c), eq(s.inventory.id, "P1")));
    assert.equal(part.stock, 10);
    const lots = await db.select().from(s.stockLots).where(eq(s.stockLots.companyId, c));
    assert.equal(lots.length, 2);
    for (const lot of lots) {
      assert.equal(Number(lot.unitCost), 17);
      assert.equal(lot.currency, "EUR");
      assert.equal(Number(lot.originalUnitCost), 20);
    }
    assert.ok(d.events.length >= 8, "every step is in the history");
    assert.equal((await po.onOrderByPart(c)).get("P1") ?? 0, 0);
  } finally {
    // Remove everything the test created, children first.
    const receipts = await db.select({ id: s.goodsReceipts.id }).from(s.goodsReceipts).where(eq(s.goodsReceipts.companyId, c));
    if (receipts.length) await db.delete(s.goodsReceiptLines).where(inArray(s.goodsReceiptLines.receiptId, receipts.map((r) => r.id)));
    await db.delete(s.goodsReceipts).where(eq(s.goodsReceipts.companyId, c));
    await db.delete(s.poEvents).where(eq(s.poEvents.companyId, c));
    await db.delete(s.purchaseOrderLines).where(eq(s.purchaseOrderLines.companyId, c));
    await db.delete(s.purchaseOrders).where(eq(s.purchaseOrders.companyId, c));
    await db.delete(s.stockLots).where(eq(s.stockLots.companyId, c));
    await db.delete(s.stockTransactions).where(eq(s.stockTransactions.companyId, c));
    await db.delete(s.inventory).where(eq(s.inventory.companyId, c));
    await db.delete(s.suppliers).where(eq(s.suppliers.companyId, c));
    await db.delete(s.users).where(eq(s.users.companyId, c));
    await db.delete(s.companies).where(eq(s.companies.id, c));
    await pool.end();
  }
});
