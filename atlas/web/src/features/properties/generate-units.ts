import { BUILDING_LAYOUTS, type BuildingLayoutFixture } from "@/mocks/fixtures/buildings";
import { UNIT_TYPES } from "@/mocks/fixtures/units";
import { PROJECTS } from "@/mocks/fixtures/projects";
import type { UnitCellData, UnitStatus } from "@/components/domain/unit-grid";
import type { UnitDrawerData } from "@/components/domain/unit-drawer";

/**
 * Procedural unit generation, ported verbatim from the design prototype's `unitAt()`/`unitColors()`
 * formulas (see `src/mocks/fixtures/units.ts` comments — the prototype never authors a fixed unit
 * list). The hash is a pure function of (buildingKey, floor, idx), so it is deterministic across
 * renders/reloads within this module — we still materialize it ONCE per building at module load
 * (below) rather than recomputing on every render, since the whole point of a "session-stable"
 * inventory is that clicking the same unit twice shows the same status/price.
 */
export interface GeneratedUnit extends UnitCellData {
  status: UnitStatus;
  floor: number;
  areaSqm: number;
  /** EGP millions */
  priceEgpM: number;
  buildingKey: string;
  buildingName: string;
  projectId: string;
  projectName: string;
}

export interface FloorUnits {
  floor: number;
  units: GeneratedUnit[];
}

export interface BuildingUnits {
  building: BuildingLayoutFixture;
  /** Highest floor first — the usual real-building convention (top-down site plan / elevator panel order). */
  floors: FloorUnits[];
  allUnits: GeneratedUnit[];
}

function unitAt(buildingKey: string, floor: number, idx: number) {
  const hash = (floor * 17 + idx * 29 + buildingKey.charCodeAt(0) * 7) % 100;
  const status: UnitStatus =
    hash < 50 ? "Sold" : hash < 78 ? "Available" : hash < 89 ? "Reserved" : hash < 95 ? "On Hold" : "Unavailable";
  const code = `${buildingKey}-${String(floor).padStart(2, "0")}${String(idx).padStart(2, "0")}`;
  const type = UNIT_TYPES[(floor + idx) % UNIT_TYPES.length];
  const priceEgpM = type.basePriceEgpM * (1 + floor * 0.014) * (buildingKey === "C" ? 1.06 : 1);
  return { status, code, type, priceEgpM };
}

function buildBuilding(projectId: string, projectName: string, building: BuildingLayoutFixture): BuildingUnits {
  const floors: FloorUnits[] = [];
  for (let floor = building.floors; floor >= 1; floor--) {
    const units: GeneratedUnit[] = [];
    for (let idx = 1; idx <= building.unitsPerFloor; idx++) {
      const u = unitAt(building.key, floor, idx);
      units.push({
        id: u.code,
        code: u.code,
        type: u.type.label,
        status: u.status,
        floor,
        areaSqm: u.type.areaSqm,
        priceEgpM: u.priceEgpM,
        buildingKey: building.key,
        buildingName: building.name,
        projectId,
        projectName,
      });
    }
    floors.push({ floor, units });
  }
  return { building, floors, allUnits: floors.flatMap((f) => f.units) };
}

/** Generated once at module load (memoized) — NOT regenerated on every render/call. */
const UNITS_BY_PROJECT: Record<string, BuildingUnits[]> = Object.fromEntries(
  Object.entries(BUILDING_LAYOUTS).map(([projectId, buildings]) => {
    const projectName = PROJECTS.find((p) => p.id === projectId)?.name ?? projectId;
    return [projectId, buildings.map((b) => buildBuilding(projectId, projectName, b))];
  }),
);

export function getProjectBuildings(projectId: string): BuildingUnits[] {
  return UNITS_BY_PROJECT[projectId] ?? [];
}

function formatEgpM(value: number): string {
  return `EGP ${value.toFixed(value < 10 ? 2 : 1)}M`;
}

/**
 * Unit-detail derivation formulas, ported verbatim from `units.ts`'s comment block:
 * paidToDate/remaining/paidPct depend only on status, and customer/agent are hardcoded
 * per-status placeholders from the prototype (not a real customer-to-unit assignment model).
 */
export function toUnitDrawerData(unit: GeneratedUnit): UnitDrawerData {
  const total = Math.round(unit.priceEgpM * 1_000_000);
  const paidToDate = unit.status === "Sold" ? Math.round(total * 0.299) : unit.status === "Reserved" ? Math.round(total * 0.03) : 0;
  const remaining = total - paidToDate;
  const paidPct = total ? (paidToDate / total) * 100 : 0;
  const [customer, agent] =
    unit.status === "Sold"
      ? ["Mona Fahmy", "Mohamed Adel"]
      : unit.status === "Reserved"
        ? ["Tarek ElGohary", "Ahmed Mohamed"]
        : ["Unassigned", "Unassigned"];

  return {
    code: unit.code,
    project: unit.projectName,
    building: unit.buildingName,
    type: unit.type,
    area: `${unit.areaSqm} m²`,
    status: unit.status,
    price: formatEgpM(unit.priceEgpM),
    paid: formatEgpM(paidToDate / 1_000_000),
    remaining: formatEgpM(remaining / 1_000_000),
    paidPct,
    customer,
    agent,
    holdReason:
      unit.status === "On Hold"
        ? "Held by the sales desk pending internal approval."
        : unit.status === "Unavailable"
          ? "Withheld from sale (show unit / developer retained)."
          : undefined,
  };
}
