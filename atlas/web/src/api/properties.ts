import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, ENDPOINTS } from "@/config";
import { formatEgp, formatEgpExact, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { titleCase } from "@/lib/text";

export type ProjectStatus = "pre-launch" | "launched" | "under-construction" | "delivered";

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  developer: string;
  status: ProjectStatus;
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalValueEgp: number;
  revenueEgp: number;
  velocityPerWeek: string;
  sellThroughPct: string;
  createdAt: string;
}

export interface CreateProjectBody {
  name: string;
  location: string;
  developer: string;
  status?: ProjectStatus;
}

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => get<ProjectRow[]>(ENDPOINTS.projects.list) });
}

/** Cross-domain name lookup: leads/customers/units all reference a projectId by id only. */
export function useProjectDirectory() {
  const { data, isLoading, error } = useProjects();
  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data ?? []) map.set(p.id, p.name);
    return map;
  }, [data]);
  return { byId, projects: data ?? [], isLoading, error };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectBody) => post<ProjectRow>(ENDPOINTS.projects.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export interface ProjectView {
  id: string;
  name: string;
  location: string;
  developer: string;
  status: string;
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalValueEgp: string;
  revenueEgp: string;
  velocity: string;
  sellThroughPct: number;
}

export function toProjectView(row: ProjectRow): ProjectView {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    developer: row.developer,
    status: titleCase(row.status),
    totalUnits: row.totalUnits,
    soldUnits: row.soldUnits,
    reservedUnits: row.reservedUnits,
    availableUnits: row.availableUnits,
    totalValueEgp: formatEgp(row.totalValueEgp),
    revenueEgp: formatEgp(row.revenueEgp),
    velocity: `${toNumber(row.velocityPerWeek).toFixed(1)}/wk`,
    sellThroughPct: Math.round(toNumber(row.sellThroughPct)),
  };
}

// ---------- Buildings ----------

export type BuildingStatus = ProjectStatus;

export interface BuildingRow {
  id: string;
  projectId: string;
  key: string;
  name: string;
  floors: number;
  unitsPerFloor: number;
  handoverDate: string | null;
  status: BuildingStatus;
  createdAt: string;
}

export interface CreateBuildingBody {
  projectId: string;
  key: string;
  name: string;
  floors: number;
  unitsPerFloor: number;
  handoverDate?: string | null;
  status?: BuildingStatus;
}

/** Omit `projectId` for the org-wide Buildings screen. */
export function useBuildings(projectId?: string) {
  return useQuery({
    queryKey: ["buildings", projectId ?? "all"],
    queryFn: () => get<BuildingRow[]>(ENDPOINTS.buildings.list, { projectId }),
  });
}

export function useCreateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBuildingBody) => post<BuildingRow>(ENDPOINTS.buildings.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["buildings"] }),
  });
}

// ---------- Units ----------

export type UnitStatus = "available" | "reserved" | "sold" | "on-hold" | "unavailable";

export interface UnitRow {
  id: string;
  buildingId: string;
  projectId: string;
  code: string;
  floor: number;
  unitType: string;
  areaSqm: string;
  basePriceEgp: number;
  status: UnitStatus;
  currentCustomerId: string | null;
  currentAgentId: string | null;
  createdAt: string;
}

export interface UnitListParams {
  projectId?: string;
  buildingId?: string;
  status?: UnitStatus;
}

/** Org-wide when called with no params — the one raw fetch that Buildings/Availability derive their rollups from. */
export function useUnits(params?: UnitListParams) {
  return useQuery({
    queryKey: ["units", params ?? {}],
    queryFn: () => get<UnitRow[]>(ENDPOINTS.units.list, params),
  });
}

export function useGenerateUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (buildingId: string) => post<UnitRow[]>(ENDPOINTS.units.generate(buildingId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateUnitStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, customerId, agentId }: { id: string; status: UnitStatus; customerId?: string | null; agentId?: string | null }) =>
      patch<UnitRow>(ENDPOINTS.units.status(id), { status, customerId, agentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ---------- Buildings view (units-derived rollup) ----------

export interface BuildingView {
  id: string;
  building: string;
  project: string;
  floors: number;
  units: number;
  sold: number;
  conversionPct: number;
  handover: string;
  status: string;
}

export function toBuildingViews(buildings: BuildingRow[], units: UnitRow[], projectName: (id: string) => string): BuildingView[] {
  const unitsByBuilding = new Map<string, UnitRow[]>();
  for (const u of units) unitsByBuilding.set(u.buildingId, [...(unitsByBuilding.get(u.buildingId) ?? []), u]);
  return buildings.map((b) => {
    const bUnits = unitsByBuilding.get(b.id) ?? [];
    const sold = bUnits.filter((u) => u.status === "sold").length;
    return {
      id: b.id,
      building: b.name,
      project: projectName(b.projectId),
      floors: b.floors,
      units: bUnits.length,
      sold,
      conversionPct: bUnits.length > 0 ? Math.round((sold / bUnits.length) * 100) : 0,
      handover: b.handoverDate ? formatDate(b.handoverDate) : "—",
      status: titleCase(b.status),
    };
  });
}

// ---------- Availability view (units-derived rollup) ----------

export interface AvailabilityView {
  key: string;
  project: string;
  unitType: string;
  available: number;
  reserved: number;
  sold: number;
  priceFromEgp: string;
  absorptionPct: number;
  agingDays: number;
}

export function toAvailabilityViews(units: UnitRow[], projectName: (id: string) => string): AvailabilityView[] {
  const now = Date.now();
  const groups = new Map<
    string,
    { projectId: string; unitType: string; available: number; reserved: number; sold: number; priceFromEgp: number; ageSumDays: number; ageCount: number }
  >();
  for (const u of units) {
    const key = `${u.projectId}::${u.unitType}`;
    const g = groups.get(key) ?? { projectId: u.projectId, unitType: u.unitType, available: 0, reserved: 0, sold: 0, priceFromEgp: u.basePriceEgp, ageSumDays: 0, ageCount: 0 };
    if (u.status === "available") g.available++;
    if (u.status === "reserved") g.reserved++;
    if (u.status === "sold") g.sold++;
    g.priceFromEgp = Math.min(g.priceFromEgp, u.basePriceEgp);
    g.ageSumDays += Math.max(0, Math.round((now - new Date(u.createdAt).getTime()) / 86_400_000));
    g.ageCount++;
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    project: projectName(g.projectId),
    unitType: g.unitType,
    available: g.available,
    reserved: g.reserved,
    sold: g.sold,
    priceFromEgp: formatEgp(g.priceFromEgp),
    absorptionPct: g.available + g.reserved + g.sold > 0 ? Math.round((g.sold / (g.available + g.reserved + g.sold)) * 100) : 0,
    agingDays: g.ageCount > 0 ? Math.round(g.ageSumDays / g.ageCount) : 0,
  }));
}

// ---------- Price lists ----------

export type PriceListStatus = "draft" | "awaiting-approval" | "active";

export interface PriceListRow {
  id: string;
  projectId: string;
  name: string;
  version: string;
  basePerSqmEgp: number;
  floorPremiumPct: string;
  maxDiscountPct: string;
  effectiveDate: string;
  status: PriceListStatus;
  createdAt: string;
}

export interface CreatePriceListBody {
  projectId: string;
  name: string;
  version: string;
  basePerSqmEgp: number;
  floorPremiumPct?: number;
  maxDiscountPct?: number;
  effectiveDate: string;
  status?: PriceListStatus;
}

/** Omit `projectId` for the org-wide Pricing screen. */
export function usePriceLists(projectId?: string) {
  return useQuery({
    queryKey: ["price-lists", projectId ?? "all"],
    queryFn: () => get<PriceListRow[]>(ENDPOINTS.priceLists.list, { projectId }),
  });
}

export function useCreatePriceList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePriceListBody) => post<PriceListRow>(ENDPOINTS.priceLists.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-lists"] }),
  });
}

export interface PriceListView {
  id: string;
  name: string;
  project: string;
  version: string;
  basePerSqmEgp: string;
  floorPremium: string;
  maxDiscount: string;
  effectiveDate: string;
  status: string;
}

export function toPriceListView(row: PriceListRow, projectName: (id: string) => string): PriceListView {
  const floorPct = toNumber(row.floorPremiumPct);
  return {
    id: row.id,
    name: row.name,
    project: projectName(row.projectId),
    version: row.version,
    basePerSqmEgp: formatEgpExact(row.basePerSqmEgp),
    floorPremium: floorPct > 0 ? `+${floorPct.toFixed(1)}% / floor` : "—",
    maxDiscount: `${toNumber(row.maxDiscountPct).toFixed(1)}%`,
    effectiveDate: formatDate(row.effectiveDate),
    status: titleCase(row.status),
  };
}

// ---------- Unit directory (cross-domain: sales/finance reference a unit by id only) ----------

export interface UnitDirectoryEntry {
  code: string;
  location: string;
  basePriceEgp: number;
  status: UnitStatus;
}

export function useUnitDirectory() {
  const units = useUnits();
  const projects = useProjectDirectory();
  const buildings = useBuildings();

  const byId = useMemo(() => {
    const buildingsById = new Map((buildings.data ?? []).map((b) => [b.id, b.name]));
    const map = new Map<string, UnitDirectoryEntry>();
    for (const u of units.data ?? []) {
      const projectName = projects.byId.get(u.projectId) ?? u.projectId;
      const buildingName = buildingsById.get(u.buildingId) ?? u.buildingId;
      map.set(u.id, { code: u.code, location: `${projectName} · ${buildingName}`, basePriceEgp: u.basePriceEgp, status: u.status });
    }
    return map;
  }, [units.data, projects.byId, buildings.data]);

  return {
    byId,
    isLoading: units.isLoading || projects.isLoading || buildings.isLoading,
    error: units.error ?? projects.error ?? buildings.error,
  };
}
