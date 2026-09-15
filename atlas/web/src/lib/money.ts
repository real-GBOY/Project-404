const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const plainFormatter = new Intl.NumberFormat("en-US");

/** "EGP 5.4M" — the compact form used everywhere in list/KPI columns. */
export function formatEgp(amountEgp: number): string {
  return `EGP ${compactFormatter.format(amountEgp)}`;
}

/** "EGP 5,800,000" — the exact grouped form used in detail views. */
export function formatEgpExact(amountEgp: number): string {
  return `EGP ${plainFormatter.format(amountEgp)}`;
}

/** Coerces a value that may arrive as a Postgres NUMERIC string (or null) into a number. */
export function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}
