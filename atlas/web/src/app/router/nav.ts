/**
 * Navigation model — mirrors the design's 9 collapsible sidebar groups
 * (PLAN §2/§8). The design itself carries no icon here (label + optional count
 * badge only); `icon` (a name from `components/ui/icon.tsx`'s registry) was
 * added on top of that for sidebar scannability and isn't part of the source design.
 */
/** Keys the sidebar resolves to a live count via its own data hooks
 *  (components/navigation/sidebar.tsx) — never a hardcoded number, so the
 *  badge can't go stale the moment the underlying data changes. */
export type NavBadgeKey = "followups" | "reservations" | "outstanding" | "approvals" | "messages";

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  badgeKey?: NavBadgeKey;
  /** also treat these path prefixes as "this item is active" */
  match?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ to: "/dashboard", label: "Executive Dashboard", icon: "dashboard" }],
  },
  {
    title: "Communication",
    items: [{ to: "/messages", label: "Messages", icon: "message", badgeKey: "messages" }],
  },
  {
    title: "CRM",
    items: [
      { to: "/leads", label: "Leads", icon: "lead" },
      { to: "/customers", label: "Customers", icon: "customer" },
      { to: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { to: "/activities", label: "Activities", icon: "activity" },
      { to: "/followups", label: "Follow-ups", icon: "followup", badgeKey: "followups" },
    ],
  },
  {
    title: "Properties",
    items: [
      { to: "/projects", label: "Projects", icon: "project" },
      { to: "/buildings", label: "Buildings", icon: "building" },
      { to: "/units", label: "Units", icon: "unit" },
      { to: "/availability", label: "Availability", icon: "availability" },
      { to: "/pricing", label: "Pricing", icon: "pricing" },
    ],
  },
  {
    title: "Sales",
    items: [
      { to: "/reservations", label: "Reservations", icon: "reservation", badgeKey: "reservations" },
      { to: "/deals", label: "Deals", icon: "deal" },
      { to: "/contracts", label: "Contracts", icon: "contract" },
      { to: "/plans", label: "Payment Plans", icon: "payment-plan" },
      { to: "/commissions", label: "Commissions", icon: "commission" },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/payments", label: "Payments", icon: "payment" },
      { to: "/installments", label: "Installments", icon: "installment" },
      { to: "/collections", label: "Collections", icon: "collection" },
      { to: "/outstanding", label: "Outstanding Payments", icon: "outstanding", badgeKey: "outstanding" },
      { to: "/finreports", label: "Financial Reports", icon: "report" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/tasks", label: "Tasks", icon: "task" },
      { to: "/workflows", label: "Workflows", icon: "workflow" },
      { to: "/approvals", label: "Approvals", icon: "approval", badgeKey: "approvals" },
      { to: "/documents", label: "Documents", icon: "doc" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { to: "/analytics/sales", label: "Sales Analytics", icon: "trend-up" },
      { to: "/analytics/leads", label: "Lead Analytics", icon: "filter" },
      { to: "/analytics/projects", label: "Project Performance", icon: "project" },
      { to: "/analytics/agents", label: "Agent Performance", icon: "users" },
      { to: "/analytics/revenue", label: "Revenue", icon: "revenue" },
      { to: "/analytics/inventory", label: "Inventory Analytics", icon: "inventory" },
    ],
  },
  {
    title: "AI",
    items: [
      { to: "/copilot", label: "AI Copilot", icon: "spark" },
      { to: "/insights", label: "Insights", icon: "insight" },
      { to: "/recommendations", label: "Recommendations", icon: "recommendation" },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/team", label: "Team", icon: "users" },
      { to: "/roles", label: "Roles & Permissions", icon: "shield" },
      { to: "/settings/organization", label: "Organization Settings", icon: "gear" },
      { to: "/audit", label: "Audit Logs", icon: "history" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/** route path → group title, for the breadcrumb ("CRM / Leads"). */
export const GROUP_OF: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((it) => [it.to, g.title])),
);

/** Special-cased titles for detail routes not literally in NAV. */
export const DETAIL_TITLES: Record<string, string> = {
  customer: "Customer 360",
  project: "Project Detail",
};
