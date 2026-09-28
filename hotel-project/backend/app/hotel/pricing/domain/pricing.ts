import { ValidationError } from "@core/kernel/errors.js";
import { dayOfWeek, eachNight, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";

/**
 * Pricing is a pure function of (stay, room type base rate, rules, discount). The server always
 * computes it — a client-supplied price is never trusted. Rules are deliberately simple and
 * explainable (the quote says which rule priced each night):
 *   - each night is priced by the single highest-priority rule that applies to it (no stacking);
 *     ties go to the room-type-specific rule, then the higher adjustment, so the result is stable;
 *   - a `percent` rule adjusts the base rate (+20 = 20% more, −10 = 10% off);
 *   - a `fixed_rate` rule replaces the base rate for that night;
 *   - any rule touching any night of the stay may impose a minimum stay;
 *   - a discount code takes a percentage off the room total if the arrival is in its window.
 */
export interface RateRule {
  id: string;
  name: string;
  kind: "seasonal" | "weekend" | "promotion";
  roomTypeId: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  /** Nights starting on these weekdays (0 = Sunday … 6 = Saturday); null = every night. */
  daysOfWeek: number[] | null;
  adjustmentType: "percent" | "fixed_rate";
  adjustmentValue: number;
  minNights: number | null;
  priority: number;
}

export interface Discount {
  code: string;
  percentOff: number;
  validFrom: IsoDate | null;
  validTo: IsoDate | null;
}

export interface NightPrice {
  date: IsoDate;
  rate: number;
  /** Name of the rule that priced this night, or null for the base rate. */
  rule: string | null;
}

export interface Quote {
  nights: NightPrice[];
  roomTotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  minNights: number;
}

export function ruleApplies(rule: RateRule, date: IsoDate, roomTypeId: string): boolean {
  if (rule.roomTypeId && rule.roomTypeId !== roomTypeId) return false;
  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  if (rule.daysOfWeek && !rule.daysOfWeek.includes(dayOfWeek(date))) return false;
  return true;
}

function winner(rules: RateRule[]): RateRule | null {
  if (rules.length === 0) return null;
  return [...rules].sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(Boolean(b.roomTypeId)) - Number(Boolean(a.roomTypeId)) ||
      b.adjustmentValue - a.adjustmentValue ||
      a.id.localeCompare(b.id),
  )[0]!;
}

function nightlyPiastres(basePiastres: number, rule: RateRule | null): number {
  if (!rule) return basePiastres;
  if (rule.adjustmentType === "fixed_rate") return toPiastres(rule.adjustmentValue);
  return Math.round(basePiastres * (1 + rule.adjustmentValue / 100));
}

export function discountValid(discount: Discount, arrival: IsoDate): boolean {
  if (discount.validFrom && arrival < discount.validFrom) return false;
  if (discount.validTo && arrival > discount.validTo) return false;
  return true;
}

export function quoteStay(input: {
  arrival: IsoDate;
  departure: IsoDate;
  roomTypeId: string;
  baseRate: number;
  rules: RateRule[];
  discount?: Discount | null;
}): Quote {
  const dates = eachNight(input.arrival, input.departure);
  if (dates.length === 0) {
    throw ValidationError("pricing.empty_stay", "Departure must be after arrival.");
  }
  const base = toPiastres(input.baseRate);
  let minNights = 1;
  let totalPiastres = 0;
  const nights: NightPrice[] = dates.map((date) => {
    const applicable = input.rules.filter((r) => ruleApplies(r, date, input.roomTypeId));
    for (const r of applicable) minNights = Math.max(minNights, r.minNights ?? 1);
    const rule = winner(applicable);
    const price = nightlyPiastres(base, rule);
    totalPiastres += price;
    return { date, rate: fromPiastres(price), rule: rule?.name ?? null };
  });

  if (dates.length < minNights) {
    throw ValidationError(
      "pricing.min_stay",
      `These dates need a stay of at least ${minNights} nights.`,
      { minNights },
    );
  }

  let discountPiastres = 0;
  let discountCode: string | null = null;
  if (input.discount) {
    if (!discountValid(input.discount, input.arrival)) {
      throw ValidationError(
        "pricing.discount_not_valid",
        "That discount code isn't valid for these dates.",
      );
    }
    discountPiastres = Math.round((totalPiastres * input.discount.percentOff) / 100);
    discountCode = input.discount.code;
  }

  return {
    nights,
    roomTotal: fromPiastres(totalPiastres),
    discountCode,
    discountAmount: fromPiastres(discountPiastres),
    total: fromPiastres(totalPiastres - discountPiastres),
    minNights,
  };
}
