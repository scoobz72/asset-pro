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

/** The company's home currency: stock, FIFO and all reports are in this currency. */
export const HOME_CURRENCY = "GBP" as const;

/**
 * Currencies a supplier or PO can use: GBP plus those in the European Central Bank's daily
 * reference rates (the rate source, see server/purchasing/rates.ts).
 */
export const CURRENCIES = [
  "GBP", "EUR", "USD", "CHF", "DKK", "SEK", "NOK", "PLN", "CZK", "HUF", "RON", "BGN", "ISK", "TRY",
  "JPY", "CNY", "HKD", "SGD", "KRW", "INR", "IDR", "MYR", "PHP", "THB", "AUD", "NZD", "CAD", "MXN",
  "BRL", "ZAR", "ILS",
] as const;
export type Currency = (typeof CURRENCIES)[number];

const SYMBOLS: Record<string, string> = {
  GBP: "£", EUR: "€", USD: "$", JPY: "¥", CNY: "¥", INR: "₹", KRW: "₩", TRY: "₺", ILS: "₪", PHP: "₱",
  THB: "฿", PLN: "zł", CHF: "CHF ", AUD: "A$", NZD: "NZ$", CAD: "C$", HKD: "HK$", SGD: "S$", ZAR: "R", BRL: "R$", MXN: "MX$",
};
export const currencySymbol = (code: string) => SYMBOLS[code] ?? `${code} `;

/**
 * Formats an amount so its currency is always clear: symbol, amount and code,
 * e.g. "£10.50 GBP" or "€12.40 EUR".
 */
export function formatMoney(amount: number | string | null | undefined, currency: string, decimals = 2): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const body = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 2) });
  return `${n < 0 ? "−" : ""}${currencySymbol(currency)}${body} ${currency}`;
}

/** Purchase order statuses, in lifecycle order (docs/asset-stock-jobs-plan.md P.2). */
export const PO_STATUSES = [
  "Draft", "Pending Approval", "Approved", "Rejected", "Sent", "Partially Received", "Received", "Closed", "Cancelled",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
/** Statuses where goods are still expected (count as "on order"). */
export const PO_OPEN_STATUSES = ["Draft", "Pending Approval", "Approved", "Sent", "Partially Received"] as const;
