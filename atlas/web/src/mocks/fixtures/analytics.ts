// Extracted verbatim from the design prototype's `ANALYTICS` class field (per-route analytics screen
// config) and `AGENTS_PERF` class field (Agent Performance leaderboard), plus the authored agent
// groupings and shared analytics filter list.

import { TOKEN_COLORS } from "@/styles/colors";

export interface AnalyticsRouteConfigFixture {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string; delta: string }[];
  /** Label for the bar-chart panel */
  bars: string;
  /** Label for the line-chart panel */
  line: string;
  lineKind: 'velocity' | 'collection';
  /** Label for the breakdown table/list panel */
  breakdown: string;
  /** an_revenue only: the chart data source deliberately renders an error state in the prototype demo */
  error?: boolean;
}

export const ANALYTICS: Record<'an_sales' | 'an_leads' | 'an_project' | 'an_revenue' | 'an_inventory', AnalyticsRouteConfigFixture> = {
  an_sales: {
    title: 'Sales Analytics',
    subtitle: 'Units, revenue and velocity across projects, buildings and agents',
    kpis: [
      { label: 'Units sold MTD', value: '58', delta: '+11' },
      { label: 'Revenue MTD', value: 'EGP 412.8M', delta: '+11.2%' },
      { label: 'Avg. deal value', value: 'EGP 6.2M', delta: '+4.0%' },
      { label: 'Velocity', value: '14.2 u/wk', delta: '+18.4%' },
      { label: 'Win rate', value: '64.8%', delta: '+1.9pp' },
    ],
    bars: 'Contracted vs. collected revenue',
    line: 'Sales velocity',
    lineKind: 'velocity',
    breakdown: 'Revenue by project',
  },
  an_leads: {
    title: 'Lead Analytics',
    subtitle: 'Source performance, conversion and funnel efficiency',
    kpis: [
      { label: 'Leads MTD', value: '312', delta: '+8.2%' },
      { label: 'Qualified', value: '148', delta: '+11.4%' },
      { label: 'Conversion', value: '11.8%', delta: '+1.4pp' },
      { label: 'Cost per lead', value: 'EGP 412', delta: '-6.1%' },
      { label: 'Best source', value: 'Referral', delta: '' },
    ],
    bars: 'Leads by month',
    line: 'Conversion rate',
    lineKind: 'collection',
    breakdown: 'Source ROI',
  },
  an_project: {
    title: 'Project Performance',
    subtitle: 'Sell-through, absorption and revenue contribution by project',
    kpis: [
      { label: 'Projects', value: '5', delta: '' },
      { label: 'Avg. sell-through', value: '61.6%', delta: '+4.2pp' },
      { label: 'Best', value: 'Cedar Residences', delta: '' },
      { label: 'Slowest', value: 'West Avenue', delta: '' },
      { label: 'Inventory aging', value: '64 days', delta: '-9' },
    ],
    bars: 'Revenue by month',
    line: 'Absorption rate',
    lineKind: 'velocity',
    breakdown: 'Project scorecard',
  },
  an_revenue: {
    title: 'Revenue',
    subtitle: 'Recognised revenue, collections and forecast',
    kpis: [
      { label: 'Contracted', value: 'EGP 17.47B', delta: '+9.4%' },
      { label: 'Collected', value: 'EGP 6.42B', delta: '+11.2%' },
      { label: 'Forecast FY26', value: 'EGP 21.8B', delta: '' },
      { label: 'Overdue', value: 'EGP 42.6M', delta: '+4.2%' },
      { label: 'Collection rate', value: '91.3%', delta: '+1.8pp' },
    ],
    bars: 'Contracted vs. collected revenue',
    line: 'Collection rate',
    lineKind: 'collection',
    breakdown: 'Revenue by project',
    error: true,
  },
  an_inventory: {
    title: 'Inventory Analytics',
    subtitle: 'Availability, absorption and aging across 1,286 units',
    kpis: [
      { label: 'Available', value: '443', delta: '-58' },
      { label: 'Reserved', value: '110', delta: '+12' },
      { label: 'Sold', value: '733', delta: '+58' },
      { label: 'Aging > 120d', value: '86', delta: '+5' },
      { label: 'Absorption', value: '4.6%/mo', delta: '+0.4pp' },
    ],
    bars: 'Absorption by month',
    line: 'Available units',
    lineKind: 'velocity',
    breakdown: 'Inventory by project',
  },
};

// Shared analytics filter bar (authored once, reused across all analytics routes):
export const ANALYTICS_FILTERS = ['Date range: Last 12 months', 'Project: All', 'Building: All', 'Agent: All', 'Source: All', 'Unit type: All'];

// deltaFg color rule (applies to every KPI above): red '#9A3838' if delta starts with '-', else green '#1E7A5A'.
// Line chart source values: 'collection' lineKind -> [86,88,87,90,89,91,88,92,90,93,89,91.3] (collection
// rate % over 12 months); 'velocity' lineKind -> [9.8,10.4,11.2,10.9,12,12.6,11.9,13.4,13.1,14,13.6,14.2]
// (units/week over 12 months). Rendered via the shared lineChart(vals, color, fill) helper (see dashboard.ts).

// Revenue/units/sell-through breakdown by project (used by an_sales/an_project/an_revenue "breakdown"
// panels) is DERIVED from projects.ts PROJECTS, not separately authored: name, revenueEgp, soldUnits,
// sellThroughPct map 1:1 (e.g. North Hills -> EGP 6.12B, 268 units, 74%).

// ---------- Agent Performance leaderboard ----------

export interface AgentPerformanceFixture {
  name: string;
  team: string;
  leads: number;
  qualified: number;
  viewings: number;
  reservations: number;
  contracts: number;
  sales: number;
  /** Revenue in EGP millions */
  revenueEgpM: number;
  /** Conversion rate percentage */
  conversionPct: number;
  /** Average deal value in EGP millions */
  avgDealEgpM: number;
  /** Follow-up compliance percentage */
  followUpPct: number;
}

export const AGENTS_PERF: AgentPerformanceFixture[] = [
  { name: 'Ahmed Mohamed', team: 'North Cairo', leads: 148, qualified: 96, viewings: 41, reservations: 14, contracts: 9, sales: 9, revenueEgpM: 52.4, conversionPct: 6.1, avgDealEgpM: 5.82, followUpPct: 94 },
  { name: 'Sara Fathy', team: 'West Cairo', leads: 141, qualified: 88, viewings: 38, reservations: 12, contracts: 8, sales: 8, revenueEgpM: 48.9, conversionPct: 5.7, avgDealEgpM: 6.11, followUpPct: 91 },
  { name: 'Youssef Hegazy', team: 'Commercial', leads: 86, qualified: 54, viewings: 22, reservations: 6, contracts: 4, sales: 4, revenueEgpM: 61.2, conversionPct: 4.7, avgDealEgpM: 15.30, followUpPct: 88 },
  { name: 'Menna Kamal', team: 'West Cairo', leads: 124, qualified: 71, viewings: 30, reservations: 9, contracts: 6, sales: 6, revenueEgpM: 31.8, conversionPct: 4.8, avgDealEgpM: 5.30, followUpPct: 84 },
  { name: 'Mohamed Adel', team: 'North Cairo', leads: 102, qualified: 58, viewings: 24, reservations: 7, contracts: 5, sales: 5, revenueEgpM: 27.4, conversionPct: 4.9, avgDealEgpM: 5.48, followUpPct: 79 },
  { name: 'Nour ElSayed', team: 'North Cairo', leads: 96, qualified: 41, viewings: 14, reservations: 4, contracts: 3, sales: 3, revenueEgpM: 14.6, conversionPct: 3.1, avgDealEgpM: 4.87, followUpPct: 58 },
  { name: 'Kariman Osman', team: 'Mostakbal', leads: 74, qualified: 22, viewings: 8, reservations: 3, contracts: 2, sales: 2, revenueEgpM: 6.2, conversionPct: 2.7, avgDealEgpM: 3.10, followUpPct: 41 },
];

// Derived per-row (leaderboard render): rank = row index + 1 (zero-padded); followUpColor = '#1E7A5A' if
// followUpPct>=85, '#1B4DB8' if >=70, else '#B4553A'; revenuePct (bar width) = round(revenueEgpM / 61.2 *
// 100) — 61.2 is the MAX revenueEgpM in this array (Youssef Hegazy), i.e. revenuePct is normalized against
// the top performer, not a fixed target. Rows are pre-sorted by revenueEgpM descending in the source.

// Authored qualitative groupings shown alongside the leaderboard (thresholds noted per group, but the
// group membership itself is authored, not computed from the thresholds against AGENTS_PERF above):
export const AGENT_GROUPS = [
  {
    label: 'Top performers',
    color: TOKEN_COLORS.success.success,
    note: 'Above target on revenue and follow-up compliance',
    items: ['Ahmed Mohamed · EGP 52.4M · 94% follow-up', 'Sara Fathy · EGP 48.9M · 91% follow-up', 'Youssef Hegazy · EGP 61.2M · 88% follow-up'],
  },
  {
    label: 'Underperforming',
    color: TOKEN_COLORS.danger.danger,
    note: 'Conversion below 3.5% or follow-up under 60%',
    items: ['Nour ElSayed · 3.1% conversion · 58% follow-up', 'Kariman Osman · 2.7% conversion · 41% follow-up'],
  },
  {
    label: 'High potential',
    color: TOKEN_COLORS.brand.primary,
    note: 'Strong conversion, capacity for more leads',
    items: ['Menna Kamal · 4.8% conversion · 30 viewings', 'Mohamed Adel · 4.9% conversion · 24 viewings'],
  },
];
