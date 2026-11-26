/**
 * Exchange rates from the European Central Bank's daily reference rates
 * (docs/asset-stock-jobs-plan.md P.5). ECB rates are "units of currency per 1 EUR";
 * a rate between two currencies is derived from both.
 */
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { exchangeRates } from "@shared/schema";
import { HOME_CURRENCY } from "@shared/constants";

const ECB_DAILY = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const ECB_90_DAYS = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const REFRESH_MS = 6 * 60 * 60 * 1000;

type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export { parseEcbXml, crossRate, toHome, type EcbRate } from "./fx";
import { parseEcbXml, crossRate } from "./fx";

export interface RateQuote {
  /** Home-currency units per 1 unit of the currency. */
  rate: number;
  rateDate: string;
  source: "ECB" | "Home" | "Manual";
}

/** The latest ECB rate on or before `onDate` (YYYY-MM-DD), or null if none is stored. */
export async function quoteRate(q: Db, currency: string, onDate: string, home: string = HOME_CURRENCY): Promise<RateQuote | null> {
  if (currency === home) return { rate: 1, rateDate: onDate, source: "Home" };
  const rows = await q.select({ rateDate: exchangeRates.rateDate, perEur: exchangeRates.perEur }).from(exchangeRates)
    .where(and(eq(exchangeRates.currency, currency), lte(exchangeRates.rateDate, onDate)))
    .orderBy(desc(exchangeRates.rateDate)).limit(1);
  if (rows.length === 0) return null;
  const [homeRow] = await q.select({ perEur: exchangeRates.perEur }).from(exchangeRates)
    .where(and(eq(exchangeRates.currency, home), eq(exchangeRates.rateDate, rows[0].rateDate)));
  if (!homeRow) return null;
  return { rate: crossRate(Number(rows[0].perEur), Number(homeRow.perEur)), rateDate: rows[0].rateDate, source: "ECB" };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "myCMMS exchange-rate fetch" } });
  if (!res.ok) throw new Error(`ECB feed returned ${res.status}`);
  return res.text();
}

/** Stores the latest ECB rates (the last 90 days the first time). Returns how many were added. */
export async function refreshRates(): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(exchangeRates);
  const rates = parseEcbXml(await fetchXml(n === 0 ? ECB_90_DAYS : ECB_DAILY));
  if (rates.length === 0) throw new Error("ECB feed contained no rates");
  const rows = rates.map((r) => ({ rateDate: r.date, currency: r.currency, perEur: r.perEur.toFixed(8) }));
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const inserted = await db.insert(exchangeRates).values(rows.slice(i, i + 500)).onConflictDoNothing().returning({ c: exchangeRates.currency });
    added += inserted.length;
  }
  return added;
}

/** Fetches rates now and every 6 hours. Failures are logged and retried next time. */
export function startRateRefresh(): void {
  const run = () => refreshRates()
    .then((added) => { if (added > 0) console.log(`[rates] stored ${added} ECB rate(s)`); })
    .catch((err) => console.warn(`[rates] couldn't fetch ECB rates: ${err instanceof Error ? err.message : err}`));
  void run();
  setInterval(run, REFRESH_MS).unref();
}
