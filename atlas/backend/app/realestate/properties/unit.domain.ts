/**
 * Deterministic unit-generation formula, ported from the frontend's
 * `atlas/web/src/mocks/fixtures/units.ts` (`unitAt()`) so demo-seeded units
 * match what the current mock UI shows. Pure function, no DB/framework.
 */
export type UnitStatus = "available" | "reserved" | "sold" | "on-hold" | "unavailable";

export interface UnitTypeSpec {
  label: string;
  areaSqm: number;
  basePriceEgpM: number;
}

/** Cycled by (floor + index) % 8, verbatim from the design's UNIT_TYPES table. */
export const UNIT_TYPES: UnitTypeSpec[] = [
  { label: "1-Bed", areaSqm: 78, basePriceEgpM: 2.9 },
  { label: "2-Bed", areaSqm: 126, basePriceEgpM: 4.2 },
  { label: "2-Bed", areaSqm: 132, basePriceEgpM: 4.4 },
  { label: "3-Bed", areaSqm: 178, basePriceEgpM: 6.4 },
  { label: "3-Bed", areaSqm: 186, basePriceEgpM: 6.8 },
  { label: "4-Bed", areaSqm: 232, basePriceEgpM: 9.1 },
  { label: "Penthouse", areaSqm: 284, basePriceEgpM: 12.8 },
  { label: "Duplex", areaSqm: 246, basePriceEgpM: 10.4 },
];

export interface GeneratedUnit {
  code: string;
  floor: number;
  status: UnitStatus;
  unitType: string;
  areaSqm: number;
  basePriceEgp: number;
}

/**
 * `hash = (floor*17 + idx*29 + buildingKey.charCodeAt(0)*7) % 100`
 * `status = hash<50 ? sold : hash<78 ? available : hash<89 ? reserved : hash<95 ? on-hold : unavailable`
 */
export function unitAt(buildingKey: string, floor: number, idx: number): GeneratedUnit {
  const hash = (floor * 17 + idx * 29 + buildingKey.charCodeAt(0) * 7) % 100;
  const status: UnitStatus =
    hash < 50 ? "sold" : hash < 78 ? "available" : hash < 89 ? "reserved" : hash < 95 ? "on-hold" : "unavailable";
  const type = UNIT_TYPES[(floor + idx) % UNIT_TYPES.length];
  return {
    code: `${buildingKey}-${String(floor).padStart(2, "0")}${String(idx).padStart(2, "0")}`,
    floor,
    status,
    unitType: type.label,
    areaSqm: type.areaSqm,
    basePriceEgp: Math.round(type.basePriceEgpM * 1_000_000),
  };
}

export function generateUnitsForBuilding(buildingKey: string, floors: number, unitsPerFloor: number): GeneratedUnit[] {
  const units: GeneratedUnit[] = [];
  for (let floor = 1; floor <= floors; floor++) {
    for (let idx = 1; idx <= unitsPerFloor; idx++) {
      units.push(unitAt(buildingKey, floor, idx));
    }
  }
  return units;
}
