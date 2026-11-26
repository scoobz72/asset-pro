/**
 * FIFO cost allocation (pure, no database): which lots an issue takes stock from,
 * and what it costs. docs/asset-stock-jobs-plan.md 1.1.
 */

export interface OpenLot {
  id: number;
  quantityRemaining: number;
  unitCost: number;
}

export interface LotTake {
  lotId: number;
  quantity: number;
  unitCost: number;
}

export interface Allocation {
  takes: LotTake[];
  /** Total cost of the units issued, to 2 dp. */
  cost: number;
  /**
   * Units not covered by any lot (stock on hand without cost layers, e.g. data from before
   * the ledger). They are costed at `fallbackUnitCost`.
   */
  uncovered: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Takes `quantity` units from `lots`, oldest first. `lots` must already be in FIFO order
 * (oldest receipt first). Never takes more than a lot holds.
 */
export function allocateFifo(lots: OpenLot[], quantity: number, fallbackUnitCost: number): Allocation {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("quantity must be a positive whole number");
  const takes: LotTake[] = [];
  let left = quantity;
  let cost = 0;
  for (const lot of lots) {
    if (left === 0) break;
    if (lot.quantityRemaining <= 0) continue;
    const take = Math.min(lot.quantityRemaining, left);
    takes.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost });
    cost += take * lot.unitCost;
    left -= take;
  }
  cost += left * fallbackUnitCost;
  return { takes, cost: round2(cost), uncovered: left };
}

/** Average unit cost of an allocation, to 4 dp (0 for an empty allocation). */
export function averageUnitCost(cost: number, quantity: number): number {
  return quantity === 0 ? 0 : Math.round((cost / quantity) * 10000) / 10000;
}
