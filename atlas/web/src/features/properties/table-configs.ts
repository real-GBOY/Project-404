import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { TableConfigRegistry } from "@/features/shared/table-types";
import { PROJECTS, type ProjectFixture } from "@/mocks/fixtures/projects";
import { BUILDINGS_TABLE, type BuildingTableRowFixture } from "@/mocks/fixtures/buildings";
import { AVAILABILITY, type AvailabilityRowFixture } from "@/mocks/fixtures/availability";
import { PRICE_LISTS, type PriceListFixture } from "@/mocks/fixtures/pricing";

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

// KPI totals are DERIVED from PROJECTS (see projects.ts's own comment) rather than re-authored —
// they reconcile with the dashboard's Portfolio value / Units sold / Available / Revenue KPIs.
const portfolioValueB = PROJECTS.reduce((sum, p) => sum + parseFloat(p.totalValueEgp), 0);
const revenueB = PROJECTS.reduce((sum, p) => sum + parseFloat(p.revenueEgp), 0);
const unitsSold = PROJECTS.reduce((sum, p) => sum + p.soldUnits, 0);
const unitsAvailable = PROJECTS.reduce((sum, p) => sum + p.availableUnits, 0);
const avgSellThrough = PROJECTS.reduce((sum, p) => sum + p.sellThroughPct, 0) / PROJECTS.length;

const projectColumns: DataColumn<ProjectFixture>[] = [
  { key: "name", label: "Project", flex: 1.5, render: (r) => TextCell({ value: r.name, sub: r.location }) },
  { key: "developer", label: "Developer", flex: 1.1, render: (r) => TextCell({ value: r.developer, weight: "normal" }) },
  { key: "status", label: "Status", width: 130, render: (r) => BadgeCell({ status: r.status }) },
  { key: "totalUnits", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.totalUnits, mono: true }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.soldUnits, mono: true }) },
  { key: "available", label: "Available", width: 76, align: "end", render: (r) => TextCell({ value: r.availableUnits, mono: true }) },
  { key: "totalValue", label: "Total Value", width: 92, align: "end", render: (r) => TextCell({ value: `EGP ${r.totalValueEgp}`, mono: true }) },
  { key: "revenue", label: "Revenue", width: 92, align: "end", render: (r) => TextCell({ value: `EGP ${r.revenueEgp}`, mono: true }) },
  { key: "sellThrough", label: "Sell-through", width: 150, render: (r) => BarCell({ pct: r.sellThroughPct, label: `${r.sellThroughPct}%` }) },
];

// ---------------------------------------------------------------------------
// buildings
// ---------------------------------------------------------------------------

const totalBuildingUnits = BUILDINGS_TABLE.reduce((sum, b) => sum + b.units, 0);
const totalBuildingSold = BUILDINGS_TABLE.reduce((sum, b) => sum + b.sold, 0);
const avgConversion = BUILDINGS_TABLE.reduce((sum, b) => sum + b.conversionPct, 0) / BUILDINGS_TABLE.length;

const buildingColumns: DataColumn<BuildingTableRowFixture>[] = [
  { key: "building", label: "Building", flex: 1.3, render: (r) => TextCell({ value: r.building, sub: r.project }) },
  { key: "floors", label: "Floors", width: 64, align: "end", render: (r) => TextCell({ value: r.floors, mono: true, weight: "normal" }) },
  { key: "units", label: "Units", width: 64, align: "end", render: (r) => TextCell({ value: r.units, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "conversion", label: "Conversion", width: 140, render: (r) => BarCell({ pct: r.conversionPct, label: `${r.conversionPct}%` }) },
  { key: "handover", label: "Handover", width: 90, render: (r) => TextCell({ value: r.handover, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 140, render: (r) => BadgeCell({ status: r.status }) },
];

// ---------------------------------------------------------------------------
// availability
// ---------------------------------------------------------------------------

const availabilityColumns: DataColumn<AvailabilityRowFixture>[] = [
  { key: "project", label: "Project", flex: 1.2, render: (r) => TextCell({ value: r.project }) },
  { key: "unitType", label: "Unit Type", flex: 1, render: (r) => TextCell({ value: r.unitType, weight: "normal" }) },
  { key: "available", label: "Available", width: 76, align: "end", render: (r) => TextCell({ value: r.available, mono: true }) },
  { key: "reserved", label: "Reserved", width: 76, align: "end", render: (r) => TextCell({ value: r.reserved, mono: true, weight: "normal" }) },
  { key: "sold", label: "Sold", width: 64, align: "end", render: (r) => TextCell({ value: r.sold, mono: true, weight: "normal" }) },
  { key: "priceFrom", label: "Price From", width: 96, align: "end", render: (r) => TextCell({ value: r.priceFromEgp, mono: true }) },
  { key: "absorption", label: "Absorption", width: 140, render: (r) => BarCell({ pct: r.absorptionPct, label: `${r.absorptionPct}%` }) },
  { key: "aging", label: "Aging", width: 70, align: "end", render: (r) => TextCell({ value: `${r.agingDays}d`, mono: true, weight: "normal" }) },
];

// ---------------------------------------------------------------------------
// pricing
// ---------------------------------------------------------------------------

const pricingColumns: DataColumn<PriceListFixture>[] = [
  { key: "name", label: "Price List", flex: 1.4, render: (r) => TextCell({ value: r.name, sub: `${r.project} · ${r.version}` }) },
  { key: "basePerSqm", label: "Base / m²", width: 100, align: "end", render: (r) => TextCell({ value: r.basePerSqmEgp, mono: true }) },
  { key: "floorPremium", label: "Floor Premium", width: 110, render: (r) => TextCell({ value: r.floorPremium, mono: true, weight: "normal" }) },
  { key: "maxDiscount", label: "Max Discount", width: 96, align: "end", render: (r) => TextCell({ value: r.maxDiscount, mono: true }) },
  { key: "effective", label: "Effective", width: 96, render: (r) => TextCell({ value: r.effectiveDate, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 130, render: (r) => BadgeCell({ status: r.status }) },
];

export const propertiesTableConfigs: TableConfigRegistry = {
  projects: {
    title: "Projects",
    subtitle: "Portfolio of active and upcoming developments",
    primaryAction: "New Project",
    columns: projectColumns,
    rows: PROJECTS,
    rowKey: (r) => r.id,
    onRowClick: (r) => `/projects/${r.id}`,
    searchPlaceholder: "Search projects…",
    searchText: (r) => `${r.name} ${r.location} ${r.developer} ${r.status}`,
    filters: ["Status", "Developer"],
    kpis: [
      { label: "Portfolio value", value: `EGP ${portfolioValueB.toFixed(2)}B` },
      { label: "Units sold", value: unitsSold.toLocaleString() },
      { label: "Available", value: unitsAvailable.toLocaleString() },
      { label: "Revenue", value: `EGP ${revenueB.toFixed(2)}B` },
      { label: "Avg. sell-through", value: `${avgSellThrough.toFixed(1)}%` },
    ],
    emptyWhy: "Projects are created by Development when a new phase or development is scoped — none match this filter yet.",
    minWidth: 900,
  },

  buildings: {
    title: "Buildings",
    subtitle: "Every building/tower across the portfolio, by construction status",
    primaryAction: "Add Building",
    columns: buildingColumns,
    rows: BUILDINGS_TABLE,
    rowKey: (r) => `${r.project}-${r.building}`,
    searchPlaceholder: "Search buildings…",
    searchText: (r) => `${r.building} ${r.project} ${r.status}`,
    filters: ["Project", "Status"],
    kpis: [
      { label: "Buildings", value: String(BUILDINGS_TABLE.length) },
      { label: "Total units", value: totalBuildingUnits.toLocaleString() },
      { label: "Sold", value: totalBuildingSold.toLocaleString() },
      { label: "Avg. conversion", value: `${avgConversion.toFixed(1)}%` },
    ],
    emptyWhy: "Buildings are added under a project once its master plan and floor layout are finalized — none match this filter yet.",
    minWidth: 860,
  },

  availability: {
    title: "Availability",
    subtitle: "Unit-type inventory and absorption across all projects",
    columns: availabilityColumns,
    rows: AVAILABILITY,
    rowKey: (r) => `${r.project}-${r.unitType}`,
    searchPlaceholder: "Search by project or unit type…",
    searchText: (r) => `${r.project} ${r.unitType}`,
    filters: ["Project", "Unit Type"],
    // Authored directly (not recomputed from AVAILABILITY rows) — see availability.ts's own comment.
    kpis: [
      { label: "Available", value: "443", delta: "-58", deltaSign: "up" },
      { label: "Reserved", value: "110", delta: "+12", deltaSign: "up" },
      { label: "Sold", value: "733", delta: "+58", deltaSign: "up" },
      { label: "On hold", value: "18", delta: "+3", deltaSign: "down" },
      { label: "Avg. days on market", value: "64", delta: "-9", deltaSign: "up" },
    ],
    emptyWhy: "Availability rolls up live inventory by unit type per project — none match this filter yet.",
    minWidth: 900,
  },

  pricing: {
    title: "Pricing",
    subtitle: "Active and draft price lists by project",
    primaryAction: "New Price List",
    columns: pricingColumns,
    rows: PRICE_LISTS,
    rowKey: (r) => r.name,
    searchPlaceholder: "Search price lists…",
    searchText: (r) => `${r.name} ${r.project} ${r.status}`,
    filters: ["Project", "Status"],
    // Authored directly — see pricing.ts's own comment (KPI count doesn't fully reconcile with rows).
    kpis: [
      { label: "Active lists", value: "7" },
      { label: "Avg. price / m²", value: "EGP 52,400", delta: "+3.8%", deltaSign: "up" },
      { label: "Max discount", value: "6.0%" },
      { label: "Pending approval", value: "2" },
    ],
    emptyWhy: "Price lists are drafted by Finance and move to Active once approved — none match this filter yet.",
    minWidth: 900,
  },
};
