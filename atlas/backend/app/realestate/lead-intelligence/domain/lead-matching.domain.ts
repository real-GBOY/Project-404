/**
 * Deterministic, explainable unit matching against a lead's structured
 * requirements — the authoritative step between AI extraction and the AI
 * explanation (see the module README / docs/lead-intelligence.md). The LLM
 * never runs this: every score and every reason here is plain arithmetic
 * over real Atlas data, reproducible and unit-testable without a model.
 *
 * Style mirrors `dashboard/domain/likely-to-sell.domain.ts`: pure functions,
 * no DB/framework, one weighted composite score per unit plus the concrete
 * factors that produced it.
 *
 * Only `status: "available"` units are ever returned — a sold/reserved/
 * on-hold/unavailable unit is never a real recommendation, however well its
 * price/location happen to line up.
 *
 * A requirement dimension the lead didn't state (e.g. no budget mentioned)
 * is left OUT of the weighted average entirely (not defaulted to a fake
 * "100") — the composite score is always an average over only the
 * dimensions the lead actually specified, re-normalised to 100.
 */
import type { LeadRequirements } from "./requirements.schema.js";
import { bedroomsOfUnitType } from "./requirements.schema.js";

export type MatchUnitStatus = "available" | "reserved" | "sold" | "on-hold" | "unavailable";
export type BuildingStatus = "pre-launch" | "launched" | "under-construction" | "delivered";

export interface MatchUnitInput {
  id: string;
  code: string;
  projectId: string;
  buildingId: string;
  unitType: string;
  floor: number;
  areaSqm: number;
  basePriceEgp: number;
  status: MatchUnitStatus;
}

export interface MatchProjectInput {
  id: string;
  name: string;
  location: string;
}

export interface MatchBuildingInput {
  id: string;
  handoverDate: string | null;
  status: BuildingStatus;
}

export type MatchReasonKey = "budget" | "location" | "type" | "floor" | "delivery";

export interface MatchReason {
  key: MatchReasonKey;
  met: boolean;
  label: string;
}

export interface UnitMatchResult {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  unitType: string;
  floor: number;
  areaSqm: number;
  basePriceEgp: number;
  /** 0-100, higher = better fit. Not a guarantee — see the reasons for why. */
  score: number;
  reasons: MatchReason[];
}

const WEIGHTS: Record<MatchReasonKey, number> = {
  budget: 30,
  location: 25,
  type: 20,
  floor: 10,
  delivery: 15,
};

interface Dim {
  score: number;
  met: boolean;
  label: string;
}

function budgetDim(req: LeadRequirements, priceEgp: number): Dim | null {
  if (req.budgetMinEgp === null && req.budgetMaxEgp === null) return null;
  const min = req.budgetMinEgp ?? 0;
  const max = req.budgetMaxEgp ?? Number.POSITIVE_INFINITY;
  if (priceEgp >= min && priceEgp <= max) {
    return { score: 100, met: true, label: "Within budget" };
  }
  if (priceEgp > max) {
    const overPct = (priceEgp - max) / max;
    return { score: Math.max(0, Math.round(100 - overPct * 200)), met: false, label: "Above budget" };
  }
  const underPct = (min - priceEgp) / min;
  return { score: Math.max(0, Math.round(100 - underPct * 200)), met: false, label: "Below budget" };
}

function locationDim(req: LeadRequirements, project: MatchProjectInput): Dim | null {
  if (req.locations.length === 0) return null;
  const haystack = `${project.name} ${project.location}`.toLowerCase();
  const met = req.locations.some((term) => haystack.includes(term.toLowerCase().trim()));
  return { score: met ? 100 : 0, met, label: met ? "In preferred location" : "Outside preferred location" };
}

function typeDim(req: LeadRequirements, unitType: string): Dim | null {
  const bedroomsGiven = req.bedroomsMin !== null || req.bedroomsMax !== null;
  const typesGiven = req.propertyTypes.length > 0;
  if (!bedroomsGiven && !typesGiven) return null;

  const bedroomCount = bedroomsOfUnitType(unitType);
  const bedroomOk =
    !bedroomsGiven ||
    (bedroomCount !== null &&
      bedroomCount >= (req.bedroomsMin ?? 0) &&
      bedroomCount <= (req.bedroomsMax ?? Number.POSITIVE_INFINITY));

  const normalizedType = unitType.toLowerCase();
  const typeOk =
    !typesGiven ||
    req.propertyTypes.some((term) => {
      const t = term.toLowerCase().trim();
      if (normalizedType.includes(t)) return true;
      if (t === "apartment" && /bed$/i.test(unitType)) return true;
      if (t === "studio" && bedroomCount === 0) return true;
      return false;
    });

  const met = bedroomOk && typeOk;
  const score = met ? 100 : bedroomOk || typeOk ? 50 : 0;
  return { score, met, label: met ? "Matches bedrooms/type" : "Doesn't match bedrooms/type" };
}

function floorDim(req: LeadRequirements, floor: number): Dim | null {
  if (req.preferredFloors.length === 0) return null;
  if (req.preferredFloors.includes(floor)) return { score: 100, met: true, label: "Preferred floor" };
  const nearest = Math.min(...req.preferredFloors.map((f) => Math.abs(f - floor)));
  return { score: Math.max(0, 100 - nearest * 25), met: false, label: "Not a preferred floor" };
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

function deliveryDim(req: LeadRequirements, building: MatchBuildingInput, now: Date): Dim | null {
  if (req.deliveryWithinMonths === null) return null;
  if (building.status === "delivered") return { score: 100, met: true, label: "Ready now" };
  if (!building.handoverDate) {
    return { score: 50, met: false, label: "Delivery timeline not yet announced" };
  }
  const deadline = addMonths(now, req.deliveryWithinMonths);
  const handover = new Date(building.handoverDate);
  if (handover <= deadline) return { score: 100, met: true, label: "Delivery timeline fits" };
  const monthsOver = monthsBetween(deadline, handover);
  return { score: Math.max(0, 100 - monthsOver * 15), met: false, label: "Delivery too far out" };
}

/**
 * Scores + ranks candidate units against a lead's requirements. Callers pass
 * the org's full unit/project/building set (same composition style as
 * `rankUnitsLikelyToSell`) — this function does the filtering and joining.
 */
export function matchUnitsToRequirements(
  units: MatchUnitInput[],
  projects: MatchProjectInput[],
  buildings: MatchBuildingInput[],
  requirements: LeadRequirements,
  now: Date,
  limit = 10,
): UnitMatchResult[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const buildingsById = new Map(buildings.map((b) => [b.id, b]));

  const results: UnitMatchResult[] = [];
  for (const unit of units) {
    if (unit.status !== "available") continue;
    const project = projectsById.get(unit.projectId);
    const building = buildingsById.get(unit.buildingId);
    if (!project || !building) continue;

    const dims: Array<[MatchReasonKey, Dim | null]> = [
      ["budget", budgetDim(requirements, unit.basePriceEgp)],
      ["location", locationDim(requirements, project)],
      ["type", typeDim(requirements, unit.unitType)],
      ["floor", floorDim(requirements, unit.floor)],
      ["delivery", deliveryDim(requirements, building, now)],
    ];

    let weightedSum = 0;
    let totalWeight = 0;
    const reasons: MatchReason[] = [];
    for (const [key, dim] of dims) {
      if (!dim) continue;
      weightedSum += dim.score * WEIGHTS[key];
      totalWeight += WEIGHTS[key];
      reasons.push({ key, met: dim.met, label: dim.label });
    }
    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    results.push({
      id: unit.id,
      code: unit.code,
      projectId: unit.projectId,
      projectName: project.name,
      unitType: unit.unitType,
      floor: unit.floor,
      areaSqm: unit.areaSqm,
      basePriceEgp: unit.basePriceEgp,
      score,
      reasons,
    });
  }

  results.sort((a, b) => b.score - a.score || a.basePriceEgp - b.basePriceEgp || a.code.localeCompare(b.code));
  return results.slice(0, limit);
}
