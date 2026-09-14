// Extracted verbatim from the design prototype's Executive Dashboard data, built inline inside
// `renderVals()` (the top KPI strip, revenue chart, inventory donut) — these are NOT derived from any
// other fixture array; they are independently authored numbers that happen to reconcile with
// PROJECTS/AVAILABILITY/LEADS totals (see notes below).

import { DATAVIZ_COLORS, TOKEN_COLORS } from "@/styles/colors";

export interface DashboardKpiFixture {
  label: string;
  value: string;
  delta: string;
  /** Delta text color */
  deltaFg: string;
  /** 8-point sparkline source values (raw units, not normalized) */
  sparkValues: number[];
  /** Sparkline fill color */
  sparkColor: string;
}

export const DASHBOARD_KPIS: DashboardKpiFixture[] = [
  { label: 'Portfolio value', value: 'EGP 32.51B', delta: '+6.2%', deltaFg: TOKEN_COLORS.success.success, sparkValues: [58, 62, 60, 68, 72, 76, 81, 88], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Revenue contracted', value: 'EGP 17.47B', delta: '+9.4%', deltaFg: TOKEN_COLORS.success.success, sparkValues: [40, 48, 52, 51, 60, 66, 74, 82], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Collected revenue', value: 'EGP 6.42B', delta: '+11.2%', deltaFg: TOKEN_COLORS.success.success, sparkValues: [30, 36, 41, 44, 52, 58, 63, 71], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Outstanding', value: 'EGP 42.6M', delta: '+4.2%', deltaFg: TOKEN_COLORS.danger.danger, sparkValues: [22, 26, 24, 30, 34, 33, 38, 42], sparkColor: TOKEN_COLORS.chart.sparkNegative },
  { label: 'Units sold', value: '733', delta: '+58', deltaFg: TOKEN_COLORS.success.success, sparkValues: [41, 44, 48, 52, 55, 61, 66, 72], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Units available', value: '443', delta: '-58', deltaFg: TOKEN_COLORS.success.success, sparkValues: [72, 68, 64, 60, 56, 52, 48, 44], sparkColor: TOKEN_COLORS.chart.sparkNeutral },
  { label: 'Reserved units', value: '110', delta: '+12', deltaFg: TOKEN_COLORS.success.success, sparkValues: [64, 70, 68, 74, 82, 88, 96, 110], sparkColor: DATAVIZ_COLORS.sparkReserved },
  { label: 'Active leads', value: '312', delta: '+8.2%', deltaFg: TOKEN_COLORS.success.success, sparkValues: [210, 228, 244, 251, 268, 284, 296, 312], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Conversion rate', value: '11.8%', delta: '+1.4pp', deltaFg: TOKEN_COLORS.success.success, sparkValues: [8.4, 9.1, 9.6, 9.4, 10.2, 10.8, 11.1, 11.8], sparkColor: TOKEN_COLORS.chart.sparkPositive },
  { label: 'Sales velocity', value: '14.2 u/wk', delta: '+18.4%', deltaFg: TOKEN_COLORS.success.success, sparkValues: [9.8, 10.4, 11.2, 10.9, 12.0, 12.6, 13.4, 14.2], sparkColor: TOKEN_COLORS.chart.sparkPositive },
];
// Note: "Units sold" (733), "Units available" (443), "Active leads" (312), "Portfolio value" (32.51B)
// and "Revenue contracted" (17.47B) values above reconcile exactly with the sums of projects.ts
// PROJECTS (soldUnits/availableUnits/totalValueEgp/revenueEgp) and the LEADS-implied "312 active leads"
// KPI copy. "Collected revenue" (6.42B) and "Outstanding" (42.6M) reconcile with PAYMENTS/OUTSTANDING
// screen subtitle copy. Sparkline formula: spark(vals) -> vals.map(v => round(v / max(vals) * 100)),
// i.e. each bar height is a percentage of that KPI's own max value in its 8-point history.

// 12-month revenue bar chart: a = contracted (EGP hundreds of millions, relative units), b = collected.
export interface RevenueMonthFixture {
  month: string;
  contracted: number;
  collected: number;
}

export const REVENUE_CHART: RevenueMonthFixture[] = [
  { month: 'Apr', contracted: 62, collected: 48 },
  { month: 'May', contracted: 68, collected: 55 },
  { month: 'Jun', contracted: 71, collected: 58 },
  { month: 'Jul', contracted: 66, collected: 61 },
  { month: 'Aug', contracted: 78, collected: 64 },
  { month: 'Sep', contracted: 82, collected: 70 },
  { month: 'Oct', contracted: 88, collected: 74 },
  { month: 'Nov', contracted: 84, collected: 78 },
  { month: 'Dec', contracted: 96, collected: 81 },
  { month: 'Jan', contracted: 91, collected: 84 },
  { month: 'Feb', contracted: 98, collected: 88 },
  { month: 'Mar', contracted: 100, collected: 91 },
];
// Only the last bar (Mar) carries a callout label: "1.42B" (the month's contracted revenue in absolute EGP).

// Inventory availability donut (dashboard widget) — authored directly, though it is consistent with
// AVAILABILITY.ts sums: Sold 733/1286=57.0%, Available 443/1286=34.4%, Reserved 110/1286=8.6%.
export interface InventoryBreakdownSliceFixture {
  label: string;
  count: string;
  pct: number;
  pctLabel: string;
  color: string;
}

export const INVENTORY_BREAKDOWN: InventoryBreakdownSliceFixture[] = [
  { label: 'Sold', count: '733', pct: 57, pctLabel: '57.0%', color: TOKEN_COLORS.brand.primary },
  { label: 'Available', count: '443', pct: 34.4, pctLabel: '34.4%', color: TOKEN_COLORS.chart.chartSecondary },
  { label: 'Reserved', count: '110', pct: 8.6, pctLabel: '8.6%', color: TOKEN_COLORS.warning.warningSolid },
  { label: 'On hold', count: '18', pct: 1.4, pctLabel: '1.4%', color: DATAVIZ_COLORS.onHold },
  { label: 'Unavailable', count: '6', pct: 0.6, pctLabel: '0.5%', color: TOKEN_COLORS.text.faint },
];
// GAP: total of the 5 counts (733+443+110+18+6=1310) is 24 units over the portfolio's own 1,286-unit
// total (PROJECTS totalUnits sum = 1,286) — a minor inconsistency in the source prototype. Also note
// pct 0.6 is labeled "0.5%" (rounding mismatch), preserved verbatim.

// Dashboard line charts reuse the exact same two 12-point series as the Analytics screens
// (see analytics.ts comment): sales velocity [9.8,10.4,...,14.2] and collection rate [86,88,...,91.3].
// lineChart(vals,color,fill) formula: normalizes each point's y between the series min/max into a fixed
// 66px-tall SVG polyline+area, x evenly spaced across a 260px-wide viewBox.

// CRM sales funnel used on the dashboard is the same authored array as pipeline-stages.ts CRM_FUNNEL —
// import from there rather than duplicating.

// Misc dashboard chrome values (authored, not really "data" but included for completeness):
export const DASHBOARD_MISC = {
  onlineCount: 12,
  updatedAt: '14:42 · 11 Mar 2026',
  insightTime: '14:00',
};
