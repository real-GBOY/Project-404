import type { InsightRequirements } from "../contracts/insights-types";

const egp = (n: number) => `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M EGP`;

/** The requirement profile as short human bullets — only what was actually extracted, nothing invented. */
export function requirementLines(r: InsightRequirements): string[] {
  const lines: string[] = [];
  if (r.bedroomsMin !== null) {
    lines.push(
      r.bedroomsMax !== null && r.bedroomsMax !== r.bedroomsMin
        ? `${r.bedroomsMin}–${r.bedroomsMax} bedrooms`
        : `${r.bedroomsMin} bedrooms`,
    );
  }
  if (r.propertyTypes.length) lines.push(r.propertyTypes.join(", "));
  if (r.locations.length) lines.push(r.locations.join(", "));
  if (r.budgetMinEgp !== null || r.budgetMaxEgp !== null) {
    const { budgetMinEgp: lo, budgetMaxEgp: hi } = r;
    lines.push(lo !== null && hi !== null && lo !== hi ? `${egp(lo)} – ${egp(hi)}` : `~${egp((hi ?? lo)!)}`);
  }
  if (r.deliveryWithinMonths !== null) lines.push(`Purchase/delivery within ${r.deliveryWithinMonths} months`);
  lines.push(...r.otherPreferences);
  return lines;
}
