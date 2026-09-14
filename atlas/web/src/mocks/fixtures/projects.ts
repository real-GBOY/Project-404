// Extracted verbatim from the design prototype's `PROJECTS` class field.
// Portfolio-level totals shown here (units sold, revenue, sell-through %, etc.) reconcile with the
// dashboard KPIs, the "Projects" table screen, and the "Project Performance" analytics breakdown —
// all of those are DERIVED from this array in the prototype (see formulas below), not separately authored.

export interface ProjectFixture {
  id: string;
  name: string;
  location: string;
  developer: string;
  status: 'Launched' | 'Under Construction' | 'Pre-launch';
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  /** Total portfolio value, formatted like "9.84B" meaning EGP 9.84 billion */
  totalValueEgp: string;
  /** Contracted revenue to date, formatted like "6.12B" meaning EGP 6.12 billion */
  revenueEgp: string;
  /** Sales velocity, e.g. "18.4/wk" = 18.4 units per week */
  velocity: string;
  /** Sell-through / completion percentage (0-100) */
  sellThroughPct: number;
}

export const PROJECTS: ProjectFixture[] = [
  { id: 'north-hills', name: 'North Hills', location: 'New Cairo · 5th Settlement', developer: 'Atlas Developments', status: 'Launched', totalUnits: 412, soldUnits: 268, reservedUnits: 31, availableUnits: 113, totalValueEgp: '9.84B', revenueEgp: '6.12B', velocity: '18.4/wk', sellThroughPct: 74 },
  { id: 'palm-district', name: 'Palm District', location: '6th of October · Sheikh Zayed', developer: 'Atlas Developments', status: 'Under Construction', totalUnits: 336, soldUnits: 194, reservedUnits: 27, availableUnits: 115, totalValueEgp: '7.21B', revenueEgp: '4.02B', velocity: '12.1/wk', sellThroughPct: 66 },
  { id: 'cedar-res', name: 'Cedar Residences', location: 'Sheikh Zayed · Beverly Hills', developer: 'Atlas × Marakez JV', status: 'Launched', totalUnits: 218, soldUnits: 176, reservedUnits: 12, availableUnits: 30, totalValueEgp: '5.44B', revenueEgp: '4.38B', velocity: '9.6/wk', sellThroughPct: 86 },
  { id: 'skyline', name: 'Skyline Business Park', location: 'New Administrative Capital', developer: 'Atlas Commercial', status: 'Under Construction', totalUnits: 184, soldUnits: 71, reservedUnits: 18, availableUnits: 95, totalValueEgp: '6.90B', revenueEgp: '2.31B', velocity: '6.2/wk', sellThroughPct: 48 },
  { id: 'west-ave', name: 'West Avenue', location: 'Mostakbal City', developer: 'Atlas Developments', status: 'Pre-launch', totalUnits: 136, soldUnits: 24, reservedUnits: 22, availableUnits: 90, totalValueEgp: '3.12B', revenueEgp: '0.64B', velocity: '4.8/wk', sellThroughPct: 34 },
];

// Derived (do not duplicate as separate fixtures — recompute from PROJECTS):
// - Portfolio value KPI (EGP 32.51B)   = sum of totalValueEgp across all projects
// - Units sold KPI (733)               = sum of soldUnits
// - Available KPI (443)                = sum of availableUnits
// - Revenue KPI (EGP 17.47B)           = sum of revenueEgp
// - Avg. sell-through KPI (61.6%)      = average of sellThroughPct
// - "Projects" table row cells         = [name+location, developer, status, totalUnits, soldUnits,
//                                          availableUnits, 'EGP '+totalValueEgp, 'EGP '+revenueEgp, sellThroughPct%]
// - Dashboard "Project Performance" list = { name, location, sold+'/'+totalUnits, 'EGP '+revenueEgp, velocity,
//                                          velocity color: '#1E7A5A' if parseFloat(velocity) >= 9 else '#8A6120',
//                                          sellThroughPct }
// - Revenue-by-project analytics breakdown reuses revenueEgp, soldUnits and sellThroughPct per project.

// ---------- Project Detail screen extras (authored only for the default-selected project, North Hills) ----------

export interface ProjectMonthlySalesFixture {
  period: string;
  units: number;
  revenue: string;
  /** Average deal value that month */
  avgDeal: string;
  velocity: string;
}

export const NORTH_HILLS_SALES_HISTORY: ProjectMonthlySalesFixture[] = [
  { period: 'Feb 2026', units: 24, revenue: 'EGP 148.2M', avgDeal: 'EGP 6.2M', velocity: '18.4/wk' },
  { period: 'Jan 2026', units: 19, revenue: 'EGP 112.6M', avgDeal: 'EGP 5.9M', velocity: '14.1/wk' },
  { period: 'Dec 2025', units: 22, revenue: 'EGP 131.4M', avgDeal: 'EGP 6.0M', velocity: '16.2/wk' },
  { period: 'Nov 2025', units: 17, revenue: 'EGP 98.8M', avgDeal: 'EGP 5.8M', velocity: '12.6/wk' },
  { period: 'Oct 2025', units: 21, revenue: 'EGP 124.1M', avgDeal: 'EGP 5.9M', velocity: '15.4/wk' },
];

export const NORTH_HILLS_FINANCIALS: { label: string; value: string }[] = [
  { label: 'Contracted', value: 'EGP 6.12B' },
  { label: 'Collected', value: 'EGP 2.84B' },
  { label: 'Due next 90 days', value: 'EGP 412.8M' },
  { label: 'Overdue', value: 'EGP 9.5M' },
  { label: 'Collection rate', value: '94.0%' },
  { label: 'Commission accrued', value: 'EGP 18.4M' },
];

// GAP: NORTH_HILLS_SALES_HISTORY / NORTH_HILLS_FINANCIALS are only authored for whichever project is
// selected on the Project Detail screen, and the prototype's default selection is North Hills — no
// equivalent per-project sales-history/financials data exists in the source for the other 4 projects.

// Per-building "sold" figures shown on the Project Detail > Buildings tab are DERIVED, not authored —
// see buildings.ts's note on the `unitAt`-style formula: sold = round(units * (0.5 + (buildingKey
// .charCodeAt(0) % 7) / 20)), units = floors * unitsPerFloor from BUILDING_LAYOUTS.

export const PROJECT_TABS = ['Overview', 'Buildings', 'Inventory', 'Sales', 'Financials', 'Analytics'];
