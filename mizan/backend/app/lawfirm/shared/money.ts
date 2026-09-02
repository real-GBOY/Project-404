/**
 * Money in the law-firm domain, matching the web contract
 * (`mizan/web/src/types/api.ts`): a `{ currency, amount }` pair where `amount`
 * is a **string**, always per-currency, never summed across currencies
 * (README §6 — multi-currency has no FX).
 */
export interface Money {
  currency: string;
  amount: string;
}

export type Currency = "EGP" | "AED" | "USD" | "SAR";

/**
 * Fold a list of `{ currency, amount:number }` entries into a `Money[]`:
 * summed per currency, zeros dropped, rounded, amount rendered as a string.
 * Ported from `mizan/web/src/mocks/**` `moneyList` so responses match byte for
 * byte.
 */
export function moneyList(entries: Array<{ currency: string; amount: number }>): Money[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .filter(([, amount]) => Math.round(amount) !== 0)
    .map(([currency, amount]) => ({ currency, amount: String(Math.round(amount)) }));
}

/** Parse a DECIMAL column (pg returns it as a string) to a number. */
export function decimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}
