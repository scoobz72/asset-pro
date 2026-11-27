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

export const JOB_TYPES = ["Breakdown", "Planned", "Request"] as const;
export const JOB_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const REQUEST_URGENCIES = ["Low", "Medium", "High"] as const;
/** Maintenance request lifecycle: submitted from the portal, then triaged into a job or rejected. */
export const REQUEST_STATUSES = ["Submitted", "Converted", "Rejected"] as const;
/** Default job priority for a request's urgency (the triager can change it). */
export const URGENCY_PRIORITY: Record<string, (typeof JOB_PRIORITIES)[number]> = { Low: "Low", Medium: "Medium", High: "High" };

export const ABSENCE_REASONS = ["Holiday", "Sickness", "Training", "Other"] as const;
/** Utilisation target band shown on reports (booked job hours ÷ shift hours). */
export const UTILISATION_TARGET = { low: 0.7, high: 0.85 } as const;

/**
 * Notification kinds. `roles` = who can receive it (null = everyone); `defaultOn` = roles it's on for
 * until the person changes it. Phone push follows the same default once they've enabled push on a device.
 */
const LEADS = ["Lead", "Manager", "Admin", "PlatformAdmin"];
export const NOTIFY_KINDS = {
  job_assigned: { label: "Jobs assigned to me", help: "When a job is given to you, or a request is turned into a job for you.", roles: null, defaultOn: null },
  request_new: { label: "New fault requests", help: "Each request submitted on the Request Portal or the mobile app, for triage.", roles: LEADS, defaultOn: LEADS },
  job_unassigned: { label: "New jobs with nobody assigned", help: "A job was created but no one has it yet.", roles: LEADS, defaultOn: LEADS },
  request_update: { label: "Updates on my requests", help: "When a request you raised becomes a job, or is rejected.", roles: null, defaultOn: null },
  stock_daily: { label: "Daily stock summary", help: "Each morning at 7:00: parts out of stock and at or below their minimum.", roles: null, defaultOn: LEADS },
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
export const STOCK_DIGEST_HOUR = 7;
