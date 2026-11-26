/**
 * Fixed lists shared by the UI dropdowns, the API validation and the import template.
 * Kept free of imports so the browser can use them without pulling in the ORM.
 */
export const LOCATION_TYPES = ["Building", "Production area", "Line", "Room", "Other"] as const;
export const ASSET_STATUSES = ["Operational", "Maintenance", "Down", "In Storage", "Loaned Out"] as const;
export const CRITICALITIES = ["A", "B", "C"] as const;
export const PART_UNITS = ["pcs", "m", "mm", "L", "ml", "kg", "g", "box", "pack", "set", "pair", "roll"] as const;

/**
 * Stock movement types. Every stock change goes through the server ledger with one of these
 * (docs/asset-stock-jobs-plan.md 1.1). "In" types add stock and create a FIFO lot; "out"
 * types consume the oldest lots first; "either" types take a signed quantity.
 */
export const STOCK_IN_TYPES = ["Stock In", "Purchase Order", "Return to Stores", "Transfer In"] as const;
export const STOCK_OUT_TYPES = ["Job Issue", "Stock Out - Damaged", "Stock Out - Missing", "Transfer Out"] as const;
export const STOCK_EITHER_TYPES = ["Stock Take Adjustment", "Import Adjustment"] as const;
export const STOCK_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES, ...STOCK_EITHER_TYPES] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
/** Types a person can choose on the Inventory page (stock takes and imports have their own screens). */
export const MANUAL_MOVEMENT_TYPES = [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES] as const;
