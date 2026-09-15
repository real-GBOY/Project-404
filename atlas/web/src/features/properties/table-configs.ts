import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { TableConfigResult } from "@/features/shared/table-types";
import {
  useProjects,
  useProjectDirectory,
  useCreateProject,
  toProjectView,
  useBuildings,
  useCreateBuilding,
  useUnits,
  toBuildingViews,
  toAvailabilityViews,
  usePriceLists,
  useCreatePriceList,
  toPriceListView,
  type ProjectView,
  type ProjectStatus,
  type BuildingView,
  type AvailabilityView,
  type PriceListView,
  type PriceListStatus,
} from "@/api/properties";

const PROJECT_STATUS_OPTIONS = ["pre-launch", "launched", "under-construction", "delivered"].map((v) => ({ value: v, label: v.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") }));

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

const projectColumns: DataColumn<ProjectView>[] = [
  { key: "name", label: "Project", flex: 1.5, render: (r) => TextCell({ value: r.name, sub: r.location }) },
  { key: "developer", label: "Developer", flex: 1.1, render: (r) => TextCell({ value: r.developer, weight: "normal" }) },
  { key: "status", label: "Status", width: 130, render: (r) => BadgeCell({ status: r.status }) },
  { key: "totalUnits", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.totalUnits, mono: true }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.soldUnits, mono: true }) },
  { key: "available", label: "Available", width: 76, align: "end", render: (r) => TextCell({ value: r.availableUnits, mono: true }) },
  { key: "totalValue", label: "Total Value", width: 92, align: "end", render: (r) => TextCell({ value: r.totalValueEgp, mono: true }) },
  { key: "revenue", label: "Revenue", width: 92, align: "end", render: (r) => TextCell({ value: r.revenueEgp, mono: true }) },
  { key: "sellThrough", label: "Sell-through", width: 150, render: (r) => BarCell({ pct: r.sellThroughPct, label: `${r.sellThroughPct}%` }) },
];

export function useProjectsTableConfig(): TableConfigResult<ProjectView> {
  const { data, isLoading, error } = useProjects();
  const createProject = useCreateProject();

  if (isLoading) return { config: undefined, isLoading: true, error: null };
  if (error) return { config: undefined, isLoading: false, error };

  const rows = (data ?? []).map(toProjectView);
  const totalValueEgp = (data ?? []).reduce((s, p) => s + p.totalValueEgp, 0);
  const revenueEgp = (data ?? []).reduce((s, p) => s + p.revenueEgp, 0);
  const unitsSold = rows.reduce((s, p) => s + p.soldUnits, 0);
  const unitsAvailable = rows.reduce((s, p) => s + p.availableUnits, 0);
  const avgSellThrough = rows.length ? rows.reduce((s, p) => s + p.sellThroughPct, 0) / rows.length : 0;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Projects",
      subtitle: "Portfolio of active and upcoming developments",
      primaryAction: "New Project",
      columns: projectColumns,
      rows,
      rowKey: (r) => r.id,
      onRowClick: (r) => `/projects/${r.id}`,
      searchPlaceholder: "Search projects…",
      searchText: (r) => `${r.name} ${r.location} ${r.developer} ${r.status}`,
      filters: ["Status", "Developer"],
      kpis: [
        { label: "Portfolio value", value: `EGP ${(totalValueEgp / 1e9).toFixed(2)}B` },
        { label: "Units sold", value: unitsSold.toLocaleString() },
        { label: "Available", value: unitsAvailable.toLocaleString() },
        { label: "Revenue", value: `EGP ${(revenueEgp / 1e9).toFixed(2)}B` },
        { label: "Avg. sell-through", value: `${avgSellThrough.toFixed(1)}%` },
      ],
      emptyWhy: "Projects are created by Development when a new phase or development is scoped — none match this filter yet.",
      minWidth: 900,
      createForm: {
        title: "New Project",
        submitLabel: "Create Project",
        fields: [
          { name: "name", label: "Name", required: true, placeholder: "e.g. North Hills" },
          { name: "location", label: "Location", required: true, placeholder: "e.g. New Cairo · 5th Settlement" },
          { name: "developer", label: "Developer", required: true, placeholder: "e.g. Atlas Developments" },
          { name: "status", label: "Status", type: "select", defaultValue: "pre-launch", options: PROJECT_STATUS_OPTIONS },
        ],
        onSubmit: async (values) => {
          await createProject.mutateAsync({
            name: values.name,
            location: values.location,
            developer: values.developer,
            status: values.status as ProjectStatus,
          });
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// buildings
// ---------------------------------------------------------------------------

const buildingColumns: DataColumn<BuildingView>[] = [
  { key: "building", label: "Building", flex: 1.3, render: (r) => TextCell({ value: r.building, sub: r.project }) },
  { key: "floors", label: "Floors", width: 64, align: "end", render: (r) => TextCell({ value: r.floors, mono: true, weight: "normal" }) },
  { key: "units", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.units, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "conversion", label: "Conversion", width: 140, render: (r) => BarCell({ pct: r.conversionPct, label: `${r.conversionPct}%` }) },
  { key: "handover", label: "Handover", width: 90, render: (r) => TextCell({ value: r.handover, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 140, render: (r) => BadgeCell({ status: r.status }) },
];

export function useBuildingsTableConfig(): TableConfigResult<BuildingView> {
  const buildings = useBuildings();
  const units = useUnits();
  const projects = useProjectDirectory();
  const createBuilding = useCreateBuilding();

  if (buildings.isLoading || units.isLoading || projects.isLoading) return { config: undefined, isLoading: true, error: null };
  if (buildings.error || units.error || projects.error) return { config: undefined, isLoading: false, error: buildings.error ?? units.error ?? projects.error };

  const rows = toBuildingViews(buildings.data ?? [], units.data ?? [], (id) => projects.byId.get(id) ?? id);
  const totalUnits = rows.reduce((s, b) => s + b.units, 0);
  const totalSold = rows.reduce((s, b) => s + b.sold, 0);
  const avgConversion = rows.length ? rows.reduce((s, b) => s + b.conversionPct, 0) / rows.length : 0;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Buildings",
      subtitle: "Every building/tower across the portfolio, by construction status",
      primaryAction: "Add Building",
      columns: buildingColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search buildings…",
      searchText: (r) => `${r.building} ${r.project} ${r.status}`,
      filters: ["Project", "Status"],
      kpis: [
        { label: "Buildings", value: String(rows.length) },
        { label: "Total units", value: totalUnits.toLocaleString() },
        { label: "Sold", value: totalSold.toLocaleString() },
        { label: "Avg. conversion", value: `${avgConversion.toFixed(1)}%` },
      ],
      emptyWhy: "Buildings are added under a project once its master plan and floor layout are finalized — none match this filter yet.",
      minWidth: 860,
      createForm: {
        title: "Add Building",
        submitLabel: "Add Building",
        fields: [
          { name: "projectId", label: "Project", type: "select", required: true, options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "key", label: "Building Key", required: true, placeholder: "e.g. D" },
          { name: "name", label: "Name", required: true, placeholder: "e.g. Building D" },
          { name: "floors", label: "Floors", type: "number", required: true, placeholder: "12" },
          { name: "unitsPerFloor", label: "Units / Floor", type: "number", required: true, placeholder: "8" },
          { name: "handoverDate", label: "Handover Date", type: "date" },
        ],
        onSubmit: async (values) => {
          await createBuilding.mutateAsync({
            projectId: values.projectId,
            key: values.key,
            name: values.name,
            floors: Number(values.floors),
            unitsPerFloor: Number(values.unitsPerFloor),
            handoverDate: values.handoverDate || null,
          });
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// availability
// ---------------------------------------------------------------------------

const availabilityColumns: DataColumn<AvailabilityView>[] = [
  { key: "project", label: "Project", flex: 1.2, render: (r) => TextCell({ value: r.project }) },
  { key: "unitType", label: "Unit Type", flex: 1, render: (r) => TextCell({ value: r.unitType, weight: "normal" }) },
  { key: "available", label: "Available", width: 76, align: "end", render: (r) => TextCell({ value: r.available, mono: true }) },
  { key: "reserved", label: "Reserved", width: 76, align: "end", render: (r) => TextCell({ value: r.reserved, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "priceFrom", label: "Price From", width: 96, align: "end", render: (r) => TextCell({ value: r.priceFromEgp, mono: true }) },
  { key: "absorption", label: "Absorption", width: 140, render: (r) => BarCell({ pct: r.absorptionPct, label: `${r.absorptionPct}%` }) },
  { key: "aging", label: "Aging", width: 70, align: "end", render: (r) => TextCell({ value: `${r.agingDays}d`, mono: true, weight: "normal" }) },
];

export function useAvailabilityTableConfig(): TableConfigResult<AvailabilityView> {
  const units = useUnits();
  const projects = useProjectDirectory();

  if (units.isLoading || projects.isLoading) return { config: undefined, isLoading: true, error: null };
  if (units.error || projects.error) return { config: undefined, isLoading: false, error: units.error ?? projects.error };

  const rows = toAvailabilityViews(units.data ?? [], (id) => projects.byId.get(id) ?? id);
  const available = rows.reduce((s, r) => s + r.available, 0);
  const reserved = rows.reduce((s, r) => s + r.reserved, 0);
  const sold = rows.reduce((s, r) => s + r.sold, 0);
  const avgAging = rows.length ? Math.round(rows.reduce((s, r) => s + r.agingDays, 0) / rows.length) : 0;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Availability",
      subtitle: "Unit-type inventory and absorption across all projects",
      columns: availabilityColumns,
      rows,
      rowKey: (r) => r.key,
      searchPlaceholder: "Search by project or unit type…",
      searchText: (r) => `${r.project} ${r.unitType}`,
      filters: ["Project", "Unit Type"],
      kpis: [
        { label: "Available", value: available.toLocaleString() },
        { label: "Reserved", value: reserved.toLocaleString() },
        { label: "Sold", value: sold.toLocaleString() },
        { label: "Avg. days on market", value: String(avgAging) },
      ],
      emptyWhy: "Availability rolls up live inventory by unit type per project — none match this filter yet.",
      minWidth: 900,
    },
  };
}

// ---------------------------------------------------------------------------
// pricing
// ---------------------------------------------------------------------------

const pricingColumns: DataColumn<PriceListView>[] = [
  { key: "name", label: "Price List", flex: 1.4, render: (r) => TextCell({ value: r.name, sub: `${r.project} · ${r.version}` }) },
  { key: "basePerSqm", label: "Base / m²", width: 100, align: "end", render: (r) => TextCell({ value: r.basePerSqmEgp, mono: true }) },
  { key: "floorPremium", label: "Floor Premium", width: 110, render: (r) => TextCell({ value: r.floorPremium, mono: true, weight: "normal" }) },
  { key: "maxDiscount", label: "Max Discount", width: 96, align: "end", render: (r) => TextCell({ value: r.maxDiscount, mono: true }) },
  { key: "effective", label: "Effective", width: 96, render: (r) => TextCell({ value: r.effectiveDate, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 130, render: (r) => BadgeCell({ status: r.status }) },
];

export function usePricingTableConfig(): TableConfigResult<PriceListView> {
  const { data, isLoading, error } = usePriceLists();
  const projects = useProjectDirectory();
  const createPriceList = useCreatePriceList();

  if (isLoading || projects.isLoading) return { config: undefined, isLoading: true, error: null };
  if (error || projects.error) return { config: undefined, isLoading: false, error: error ?? projects.error };

  const rows = (data ?? []).map((r) => toPriceListView(r, (id) => projects.byId.get(id) ?? id));
  const activeCount = rows.filter((r) => r.status === "Active").length;
  const pendingCount = rows.filter((r) => r.status === "Awaiting Approval").length;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Pricing",
      subtitle: "Active and draft price lists by project",
      primaryAction: "New Price List",
      columns: pricingColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search price lists…",
      searchText: (r) => `${r.name} ${r.project} ${r.status}`,
      filters: ["Project", "Status"],
      kpis: [
        { label: "Active lists", value: String(activeCount) },
        { label: "Pending approval", value: String(pendingCount) },
        { label: "Total lists", value: String(rows.length) },
      ],
      emptyWhy: "Price lists are drafted by Finance and move to Active once approved — none match this filter yet.",
      minWidth: 900,
      createForm: {
        title: "New Price List",
        submitLabel: "Create Price List",
        fields: [
          { name: "projectId", label: "Project", type: "select", required: true, options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
          { name: "name", label: "Name", required: true, placeholder: "e.g. NH Residential Q2-26" },
          { name: "version", label: "Version", required: true, placeholder: "v1.0" },
          { name: "basePerSqmEgp", label: "Base / m² (EGP)", type: "number", required: true, placeholder: "58200" },
          { name: "floorPremiumPct", label: "Floor Premium %", type: "number", placeholder: "1.4" },
          { name: "maxDiscountPct", label: "Max Discount %", type: "number", placeholder: "5" },
          { name: "effectiveDate", label: "Effective Date", type: "date", required: true },
          {
            name: "status",
            label: "Status",
            type: "select",
            defaultValue: "draft",
            options: [
              { value: "draft", label: "Draft" },
              { value: "awaiting-approval", label: "Awaiting Approval" },
              { value: "active", label: "Active" },
            ],
          },
        ],
        onSubmit: async (values) => {
          await createPriceList.mutateAsync({
            projectId: values.projectId,
            name: values.name,
            version: values.version,
            basePerSqmEgp: Number(values.basePerSqmEgp),
            floorPremiumPct: values.floorPremiumPct ? Number(values.floorPremiumPct) : undefined,
            maxDiscountPct: values.maxDiscountPct ? Number(values.maxDiscountPct) : undefined,
            effectiveDate: values.effectiveDate,
            status: values.status as PriceListStatus,
          });
        },
      },
    },
  };
}
