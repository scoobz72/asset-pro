/** Pure exchange-rate helpers (no database), so they can be unit-tested. */

export interface EcbRate { date: string; currency: string; perEur: number }

/** Reads the ECB XML feed. EUR itself is added at 1 for each date. Pure, for testing. */
export function parseEcbXml(xml: string): EcbRate[] {
  const out: EcbRate[] = [];
  const dayRe = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g;
  const rateRe = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/g;
  let day: RegExpExecArray | null;
  while ((day = dayRe.exec(xml))) {
    const date = day[1];
    out.push({ date, currency: "EUR", perEur: 1 });
    let r: RegExpExecArray | null;
    rateRe.lastIndex = 0;
    while ((r = rateRe.exec(day[2]))) {
      const perEur = Number(r[2]);
      if (Number.isFinite(perEur) && perEur > 0) out.push({ date, currency: r[1], perEur });
    }
  }
  return out;
}

/** Home-currency units per 1 unit of `currency`, from both currencies' per-EUR rates. */
export function crossRate(currencyPerEur: number, homePerEur: number): number {
  return Math.round((homePerEur / currencyPerEur) * 1e8) / 1e8;
}

/** Converts a price into the home currency at `rate`, to 4 decimal places. */
export function toHome(amount: number, rate: number): number {
  return Math.round(amount * rate * 10000) / 10000;
}

