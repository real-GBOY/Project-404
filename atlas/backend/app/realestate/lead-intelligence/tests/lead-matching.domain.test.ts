import { describe, expect, it } from "vitest";
import { matchUnitsToRequirements, type MatchBuildingInput, type MatchProjectInput, type MatchUnitInput } from "../domain/lead-matching.domain.js";
import { EMPTY_REQUIREMENTS, type LeadRequirements } from "../domain/requirements.schema.js";

const NOW = new Date("2026-09-17T00:00:00Z");

const PROJECTS: MatchProjectInput[] = [
  { id: "prj_hills", name: "North Hills", location: "New Cairo · 5th Settlement" },
  { id: "prj_west", name: "West Avenue", location: "Mostakbal City" },
];

const BUILDINGS: MatchBuildingInput[] = [
  { id: "bld_a", handoverDate: "2027-06-01", status: "under-construction" },
  { id: "bld_delivered", handoverDate: null, status: "delivered" },
  { id: "bld_unknown", handoverDate: null, status: "pre-launch" },
];

function unit(over: Partial<MatchUnitInput> & { id: string }): MatchUnitInput {
  return {
    code: over.id,
    projectId: "prj_hills",
    buildingId: "bld_a",
    unitType: "3-Bed",
    floor: 3,
    areaSqm: 178,
    basePriceEgp: 6_400_000,
    status: "available",
    ...over,
  };
}

function req(over: Partial<LeadRequirements>): LeadRequirements {
  return { ...EMPTY_REQUIREMENTS, ...over };
}

describe("lead-intelligence/domain lead-matching", () => {
  it("scores an exact match at 100 across every stated dimension", () => {
    const requirements = req({
      budgetMinEgp: 6_000_000,
      budgetMaxEgp: 7_000_000,
      locations: ["New Cairo"],
      propertyTypes: ["apartment"],
      bedroomsMin: 3,
      bedroomsMax: 3,
      preferredFloors: [3],
    });
    const [result] = matchUnitsToRequirements([unit({ id: "A" })], PROJECTS, BUILDINGS, requirements, NOW);
    expect(result.score).toBe(100);
    expect(result.reasons.every((r) => r.met)).toBe(true);
  });

  it("a budget mismatch (well above range) scores clearly lower than an in-budget unit", () => {
    const requirements = req({ budgetMinEgp: 4_000_000, budgetMaxEgp: 5_000_000 });
    const [inBudget, overBudget] = matchUnitsToRequirements(
      [unit({ id: "cheap", basePriceEgp: 4_500_000 }), unit({ id: "pricey", basePriceEgp: 9_000_000 })],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(inBudget.id).toBe("cheap");
    expect(inBudget.score).toBeGreaterThan(overBudget.score);
    expect(overBudget.reasons.find((r) => r.key === "budget")?.met).toBe(false);
  });

  it("a location mismatch scores lower than a matching location, all else equal", () => {
    const requirements = req({ locations: ["New Cairo"] });
    const [match, mismatch] = matchUnitsToRequirements(
      [unit({ id: "in-cairo" }), unit({ id: "elsewhere", projectId: "prj_west" })],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(match.id).toBe("in-cairo");
    expect(match.score).toBeGreaterThan(mismatch.score);
    expect(mismatch.reasons.find((r) => r.key === "location")?.met).toBe(false);
  });

  it("a bedroom-count mismatch scores lower than a matching bedroom count", () => {
    const requirements = req({ bedroomsMin: 3, bedroomsMax: 3 });
    const [match, mismatch] = matchUnitsToRequirements(
      [unit({ id: "3bed", unitType: "3-Bed" }), unit({ id: "1bed", unitType: "1-Bed" })],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(match.id).toBe("3bed");
    expect(match.score).toBeGreaterThan(mismatch.score);
  });

  it("floor preference: the exact preferred floor beats a distant one", () => {
    const requirements = req({ preferredFloors: [1] });
    const [preferred, distant] = matchUnitsToRequirements(
      [unit({ id: "floor1", floor: 1 }), unit({ id: "floor9", floor: 9 })],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(preferred.id).toBe("floor1");
    expect(preferred.score).toBeGreaterThan(distant.score);
  });

  it("excludes non-available units even when every other dimension matches perfectly", () => {
    const requirements = req({ budgetMinEgp: 6_000_000, budgetMaxEgp: 7_000_000 });
    const results = matchUnitsToRequirements(
      [
        unit({ id: "sold", status: "sold" }),
        unit({ id: "reserved", status: "reserved" }),
        unit({ id: "on-hold", status: "on-hold" }),
        unit({ id: "unavailable", status: "unavailable" }),
      ],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(results).toHaveLength(0);
  });

  it("a delivery deadline the building's handover date exceeds scores lower than one that fits", () => {
    const requirements = req({ deliveryWithinMonths: 6 });
    const [fits, tooLate] = matchUnitsToRequirements(
      [
        unit({ id: "fits", buildingId: "bld_delivered" }),
        unit({ id: "too-late", buildingId: "bld_a" }), // handover 2027-06, ~9 months out from NOW
      ],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(fits.id).toBe("fits");
    expect(fits.score).toBeGreaterThan(tooLate.score);
  });

  it("an unannounced delivery date is treated as neutral, not a hard fail", () => {
    const requirements = req({ deliveryWithinMonths: 6 });
    const [result] = matchUnitsToRequirements([unit({ id: "A", buildingId: "bld_unknown" })], PROJECTS, BUILDINGS, requirements, NOW);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("returns every genuine candidate when several qualify, ranked strictly by descending score", () => {
    const requirements = req({ budgetMinEgp: 3_000_000, budgetMaxEgp: 10_000_000 });
    const results = matchUnitsToRequirements(
      [
        unit({ id: "a", basePriceEgp: 6_400_000 }),
        unit({ id: "b", basePriceEgp: 20_000_000 }),
        unit({ id: "c", basePriceEgp: 6_900_000 }),
      ],
      PROJECTS,
      BUILDINGS,
      requirements,
      NOW,
    );
    expect(results.length).toBe(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("no available inventory anywhere near the requirements still returns candidates, ranked honestly low — never fabricated, never hidden", () => {
    const requirements = req({ locations: ["Nowhere Land"], budgetMinEgp: 1_000_000, budgetMaxEgp: 2_000_000 });
    const [result] = matchUnitsToRequirements([unit({ id: "A", basePriceEgp: 6_400_000 })], PROJECTS, BUILDINGS, requirements, NOW);
    expect(result.score).toBeLessThan(30);
    expect(result.reasons.every((r) => r.met === false)).toBe(true);
  });

  it("with zero available units, returns an empty list rather than throwing", () => {
    const results = matchUnitsToRequirements([], PROJECTS, BUILDINGS, req({ locations: ["Nowhere Land"] }), NOW);
    expect(results).toEqual([]);
  });

  it("is deterministic — identical inputs produce identical scores and ordering every time", () => {
    const requirements = req({ budgetMinEgp: 5_000_000, budgetMaxEgp: 8_000_000, locations: ["New Cairo"], bedroomsMin: 2, bedroomsMax: 3 });
    const units = [unit({ id: "a", basePriceEgp: 6_400_000 }), unit({ id: "b", basePriceEgp: 4_200_000, unitType: "2-Bed" })];
    const run1 = matchUnitsToRequirements(units, PROJECTS, BUILDINGS, requirements, NOW);
    const run2 = matchUnitsToRequirements(units, PROJECTS, BUILDINGS, requirements, NOW);
    expect(run1).toEqual(run2);
  });

  it("respects the limit", () => {
    const units = Array.from({ length: 5 }, (_, i) => unit({ id: `u${i}`, basePriceEgp: 6_000_000 + i * 10_000 }));
    const results = matchUnitsToRequirements(units, PROJECTS, BUILDINGS, EMPTY_REQUIREMENTS, NOW, 2);
    expect(results).toHaveLength(2);
  });

  it("with no stated requirements at all, there is nothing to score against — 0 with no reasons, not a fabricated 100", () => {
    const [result] = matchUnitsToRequirements([unit({ id: "A" })], PROJECTS, BUILDINGS, EMPTY_REQUIREMENTS, NOW);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });
});
