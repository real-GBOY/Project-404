import { describe, expect, it } from "vitest";
import { quoteStay, type RateRule } from "./pricing.js";

const rule = (over: Partial<RateRule>): RateRule => ({
  id: over.id ?? "r1",
  name: over.name ?? "Rule",
  kind: "seasonal",
  roomTypeId: null,
  startDate: null,
  endDate: null,
  daysOfWeek: null,
  adjustmentType: "percent",
  adjustmentValue: 0,
  minNights: null,
  priority: 0,
  ...over,
});

const stay = { roomTypeId: "rmt_dlx", baseRate: 5400 };

describe("quoteStay", () => {
  it("prices every night at the base rate with no rules", () => {
    const q = quoteStay({ ...stay, arrival: "2026-10-04", departure: "2026-10-07", rules: [] });
    expect(q.nights.map((n) => n.rate)).toEqual([5400, 5400, 5400]);
    expect(q).toMatchObject({ roomTotal: 16200, discountAmount: 0, total: 16200, minNights: 1 });
  });

  it("applies an Egyptian weekend uplift only to Thursday and Friday nights", () => {
    const weekend = rule({
      name: "Weekend",
      kind: "weekend",
      daysOfWeek: [4, 5],
      adjustmentValue: 15,
    });
    // Wed 2026-09-30 → Sat 2026-10-03: nights Wed, Thu, Fri.
    const q = quoteStay({
      ...stay,
      arrival: "2026-09-30",
      departure: "2026-10-03",
      rules: [weekend],
    });
    expect(q.nights).toEqual([
      { date: "2026-09-30", rate: 5400, rule: null },
      { date: "2026-10-01", rate: 6210, rule: "Weekend" },
      { date: "2026-10-02", rate: 6210, rule: "Weekend" },
    ]);
    expect(q.roomTotal).toBe(17820);
  });

  it("lets the highest-priority rule win a night instead of stacking", () => {
    const season = rule({
      id: "s",
      name: "Autumn",
      startDate: "2026-10-01",
      endDate: "2026-11-30",
      adjustmentValue: 20,
      priority: 1,
    });
    const weekend = rule({
      id: "w",
      name: "Weekend",
      daysOfWeek: [4, 5],
      adjustmentValue: 15,
      priority: 2,
    });
    const q = quoteStay({
      ...stay,
      arrival: "2026-10-01",
      departure: "2026-10-03",
      rules: [season, weekend],
    });
    expect(q.nights.map((n) => n.rule)).toEqual(["Weekend", "Weekend"]);
    const q2 = quoteStay({
      ...stay,
      arrival: "2026-10-04",
      departure: "2026-10-05",
      rules: [season, weekend],
    });
    expect(q2.nights).toEqual([{ date: "2026-10-04", rate: 6480, rule: "Autumn" }]);
  });

  it("ignores rules for other room types; a fixed rate replaces the base", () => {
    const suiteOnly = rule({ roomTypeId: "rmt_ste", adjustmentValue: 50, priority: 5 });
    const promo = rule({
      id: "p",
      name: "Flash sale",
      kind: "promotion",
      adjustmentType: "fixed_rate",
      adjustmentValue: 3999,
      priority: 1,
    });
    const q = quoteStay({
      ...stay,
      arrival: "2026-10-04",
      departure: "2026-10-05",
      rules: [suiteOnly, promo],
    });
    expect(q.nights).toEqual([{ date: "2026-10-04", rate: 3999, rule: "Flash sale" }]);
  });

  it("enforces the strictest minimum stay touching any night", () => {
    const newYear = rule({
      name: "New Year",
      startDate: "2026-12-30",
      endDate: "2027-01-01",
      adjustmentValue: 35,
      minNights: 3,
    });
    expect(() =>
      quoteStay({ ...stay, arrival: "2026-12-31", departure: "2027-01-02", rules: [newYear] }),
    ).toThrow(expect.objectContaining({ code: "pricing.min_stay" }));
    const ok = quoteStay({
      ...stay,
      arrival: "2026-12-30",
      departure: "2027-01-02",
      rules: [newYear],
    });
    expect(ok.minNights).toBe(3);
  });

  it("takes a discount code's percentage off the room total, in whole piastres", () => {
    const q = quoteStay({
      ...stay,
      baseRate: 4199.99,
      arrival: "2026-10-04",
      departure: "2026-10-07",
      rules: [],
      discount: { code: "NILE10", percentOff: 10, validFrom: null, validTo: null },
    });
    expect(q).toMatchObject({
      roomTotal: 12599.97,
      discountAmount: 1260,
      total: 11339.97,
      discountCode: "NILE10",
    });
  });

  it("refuses a discount outside its validity window", () => {
    expect(() =>
      quoteStay({
        ...stay,
        arrival: "2026-10-04",
        departure: "2026-10-05",
        rules: [],
        discount: {
          code: "SUMMER",
          percentOff: 10,
          validFrom: "2026-06-01",
          validTo: "2026-08-31",
        },
      }),
    ).toThrow(expect.objectContaining({ code: "pricing.discount_not_valid" }));
  });
});
