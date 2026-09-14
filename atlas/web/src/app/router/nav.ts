/**
 * Navigation model — mirrors the design's 9 collapsible sidebar groups
 * (PLAN §2/§8). Nav items in the design carry NO icon, label + optional
 * count badge only.
 */
export interface NavItem {
  to: string;
  label: string;
  badge?: number;
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
    items: [{ to: "/dashboard", label: "Executive Dashboard" }],
  },
  {
    title: "CRM",
    items: [
      { to: "/leads", label: "Leads" },
      { to: "/customers", label: "Customers" },
      { to: "/pipeline", label: "Pipeline" },
      { to: "/activities", label: "Activities" },
      { to: "/followups", label: "Follow-ups", badge: 23 },
    ],
  },
  {
    title: "Properties",
    items: [
      { to: "/projects", label: "Projects" },
      { to: "/buildings", label: "Buildings" },
      { to: "/units", label: "Units" },
      { to: "/availability", label: "Availability" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Sales",
    items: [
      { to: "/reservations", label: "Reservations", badge: 4 },
      { to: "/deals", label: "Deals" },
      { to: "/contracts", label: "Contracts" },
      { to: "/plans", label: "Payment Plans" },
      { to: "/commissions", label: "Commissions" },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/payments", label: "Payments" },
      { to: "/installments", label: "Installments" },
      { to: "/collections", label: "Collections" },
      { to: "/outstanding", label: "Outstanding Payments", badge: 12 },
      { to: "/finreports", label: "Financial Reports" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/tasks", label: "Tasks" },
      { to: "/workflows", label: "Workflows" },
      { to: "/approvals", label: "Approvals", badge: 7 },
      { to: "/documents", label: "Documents" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { to: "/analytics/sales", label: "Sales Analytics" },
      { to: "/analytics/leads", label: "Lead Analytics" },
      { to: "/analytics/projects", label: "Project Performance" },
      { to: "/analytics/agents", label: "Agent Performance" },
      { to: "/analytics/revenue", label: "Revenue" },
      { to: "/analytics/inventory", label: "Inventory Analytics" },
    ],
  },
  {
    title: "AI",
    items: [
      { to: "/copilot", label: "AI Copilot" },
      { to: "/insights", label: "Insights" },
      { to: "/recommendations", label: "Recommendations" },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/team", label: "Team" },
      { to: "/roles", label: "Roles & Permissions" },
      { to: "/settings/organization", label: "Organization Settings" },
      { to: "/audit", label: "Audit Logs" },
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
