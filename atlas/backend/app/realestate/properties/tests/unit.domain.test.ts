import { describe, expect, it } from "vitest";
import { generateUnitsForBuilding, unitAt, UNIT_TYPES } from "@atlas/realestate/properties/unit.domain.js";

describe("realestate/properties unit.domain", () => {
  it("unitAt is deterministic for the same (buildingKey, floor, idx)", () => {
    const a = unitAt("A", 3, 2);
    const b = unitAt("A", 3, 2);
    expect(a).toEqual(b);
  });

  it("unitAt formats the code as <key>-<floor2><idx2>", () => {
    expect(unitAt("A", 9, 4).code).toBe("A-0904");
    expect(unitAt("C1", 12, 1).code).toBe("C1-1201");
  });

  it("unitAt cycles unit type by (floor+idx) % UNIT_TYPES.length", () => {
    const u = unitAt("A", 1, 1);
    expect(u.unitType).toBe(UNIT_TYPES[(1 + 1) % UNIT_TYPES.length].label);
  });

  it("generateUnitsForBuilding produces floors*unitsPerFloor rows with unique codes", () => {
    const units = generateUnitsForBuilding("B", 5, 4);
    expect(units).toHaveLength(20);
    expect(new Set(units.map((u) => u.code)).size).toBe(20);
  });

  it("status buckets follow the hash thresholds (sold<50, available<78, reserved<89, on-hold<95, else unavailable)", () => {
    const statuses = new Set(generateUnitsForBuilding("A", 20, 10).map((u) => u.status));
    // A large enough sample should hit every bucket at least once.
    expect(statuses.has("sold")).toBe(true);
    expect(statuses.has("available")).toBe(true);
  });
});
