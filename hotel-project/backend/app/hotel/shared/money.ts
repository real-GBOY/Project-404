/**
 * Money is EGP with two decimals, stored as `numeric` (node-postgres returns it as a string).
 * Arithmetic happens on integer piastres so sums never drift; conversion lives only here.
 */
export function toPiastres(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Not a money amount: ${String(value)}`);
  return Math.round(n * 100);
}

export function fromPiastres(piastres: number): number {
  return piastres / 100;
}

/** A numeric column value as a JS number of pounds (2 dp). */
export function moneyNumber(value: string | number): number {
  return fromPiastres(toPiastres(value));
}

/** A JS amount as the exact string to write into a numeric(…, 2) column. */
export function moneyString(value: number): string {
  return (toPiastres(value) / 100).toFixed(2);
}

/** "7,722.60 EGP" — for human-readable text the server writes (alerts, timeline entries). */
export function formatEgp(value: number): string {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
}
