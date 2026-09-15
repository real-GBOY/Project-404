/**
 * Content and style helpers for the public landing page.
 *
 * Ported from the Claude Design prototype `Atlas RE OS Landing.dc.html` and its
 * `support.js` runtime. Colors are pulled from `TOKEN_COLORS` (the app's single
 * source of truth, `src/styles/colors.ts`) rather than re-hardcoded, so the
 * landing page always matches the live product identity — including the
 * brightened Survey Ochre.
 */
import type { CSSProperties } from "react";
import { TOKEN_COLORS } from "@/styles/colors";

export const INK = TOKEN_COLORS.text.foreground; // #14181d
export const GRAPHITE = TOKEN_COLORS.surface.sidebar; // #0d1013 — darkest section bg
export const GRAPHITE_RAISED = TOKEN_COLORS.surface.surfaceSidebarSubtle; // #14181d — card-on-dark bg
export const GRAPHITE_HOVER = TOKEN_COLORS.surface.surfaceNavHover; // #1d232a
export const HAIRLINE_DARK = TOKEN_COLORS.border.borderSidebar; // #2a323b
export const PAPER = TOKEN_COLORS.surface.surfaceSubtle; // #f7f6f3
export const CANVAS = TOKEN_COLORS.surface.canvas; // #efede8
export const SURFACE = TOKEN_COLORS.surface.surface; // #ffffff
export const HAIRLINE = TOKEN_COLORS.border.border; // #e2dfd8
export const BODY_TEXT = TOKEN_COLORS.text.body; // #2a323b
export const SECONDARY_TEXT = TOKEN_COLORS.text.secondary; // #5c6672
export const MUTED_TEXT = TOKEN_COLORS.text.muted; // #8a939e
export const FAINT_TEXT = TOKEN_COLORS.text.faint; // #c4c9cf
export const OCHRE = TOKEN_COLORS.brand.primary;
export const OCHRE_DEEP = TOKEN_COLORS.brand.primaryDeep;
export const OCHRE_FOREGROUND = TOKEN_COLORS.brand.primaryForeground;
export const CYAN = TOKEN_COLORS.info.info;
export const CYAN_STRONG = TOKEN_COLORS.info.infoStrong;
export const GREEN = TOKEN_COLORS.success.success;
export const GREEN_STRONG = TOKEN_COLORS.success.successStrong;
export const RED = TOKEN_COLORS.danger.danger;
export const RED_STRONG = TOKEN_COLORS.danger.dangerSecondary;
export const AMBER = TOKEN_COLORS.warning.warningSolid;
/** decorative link underline on the landing page only — not part of the app token system */
export const LINK_UNDERLINE = "#d9cbb0";

/** Turn a CSS declaration string into a React style object — lets sections read close to the source .dc.html. */
export function css(decls: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of decls.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const raw = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!raw || !value) continue;
    const prop = raw.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[prop] = value;
  }
  return out as CSSProperties;
}

/** Initial state + transition for a scroll-reveal element; `delayMs` staggers a group. */
export function reveal(delayMs = 0): CSSProperties {
  const d = delayMs ? `${delayMs}ms` : "0ms";
  return {
    opacity: 0,
    transform: "translateY(14px)",
    transition: `opacity .5s cubic-bezier(.2,0,0,1) ${d}, transform .5s cubic-bezier(.2,0,0,1) ${d}`,
  };
}

export type UnitCode = "A" | "R" | "C" | "S" | "B";

interface UnitStyle {
  bg: string;
  border: string;
  fg: string;
}

/** The five commercial states shown on the landing page's unit mocks — a superset of the app's own unit-status vocabulary, used here purely for illustration. */
export const UNIT_STYLE_LIGHT: Record<UnitCode, UnitStyle> = {
  A: { bg: TOKEN_COLORS.unit.unitAvailableFill, border: TOKEN_COLORS.unit.unitAvailableBorder, fg: TOKEN_COLORS.unit.unitAvailableFg },
  R: { bg: OCHRE, border: OCHRE, fg: OCHRE_FOREGROUND },
  C: { bg: CYAN, border: CYAN, fg: SURFACE },
  S: { bg: GREEN, border: GREEN, fg: SURFACE },
  B: { bg: CANVAS, border: TOKEN_COLORS.unit.unitAvailableBorder, fg: MUTED_TEXT },
};

export const UNIT_STYLE_DARK: Record<UnitCode, UnitStyle> = {
  A: { bg: GRAPHITE_RAISED, border: SECONDARY_TEXT, fg: SECONDARY_TEXT },
  R: { bg: OCHRE, border: OCHRE, fg: OCHRE_FOREGROUND },
  C: { bg: CYAN, border: CYAN, fg: SURFACE },
  S: { bg: GREEN, border: GREEN, fg: SURFACE },
  B: { bg: GRAPHITE_HOVER, border: HAIRLINE_DARK, fg: MUTED_TEXT },
};

function statusFor(i: number): UnitCode {
  const k = (i * 7 + ((i * 13) % 5)) % 11;
  if (k < 4) return "S";
  if (k < 6) return "C";
  if (k === 6) return "R";
  if (k === 10) return "B";
  return "A";
}

export interface UnitCell {
  code: UnitCode;
  bg: string;
  border: string;
  fg: string;
}

export interface UnitFloor {
  label: string;
  units: UnitCell[];
}

/** Deterministic mock unit grid — the same pseudo-random layout on every load/render. */
export function unitGrid(rows: number, cols: number, tone: "light" | "dark"): UnitFloor[] {
  const map = tone === "light" ? UNIT_STYLE_LIGHT : UNIT_STYLE_DARK;
  const out: UnitFloor[] = [];
  for (let r = 0; r < rows; r++) {
    const units: UnitCell[] = [];
    for (let c = 0; c < cols; c++) {
      const code = statusFor(r * cols + c * 3 + r);
      const st = map[code];
      units.push({ code, bg: st.bg, border: st.border, fg: st.fg });
    }
    out.push({ label: String(34 - r).padStart(2, "0"), units });
  }
  return out;
}

export const ANALYTICS_BAR_HEIGHTS = [62, 74, 55, 81, 69, 92, 78, 88, 71, 84];

export const PROBLEMS = [
  "Leads scattered across portals, inboxes and spreadsheets",
  "Inventory tracked in a file that is already out of date",
  "Pipelines that don't know which unit a deal is for",
  "Reservations and contracts managed outside the CRM",
  "Payment schedules rebuilt by hand every month",
  "Operations running on chat threads and shared drives",
  "Management asking four teams for one number",
  "Business history buried across disconnected systems",
];

export const ANSWERS = [
  "One lead record from first touch to signed contract",
  "Live unit inventory down to the floor and stack",
  "Every deal tied to the unit it will actually sell",
  "Reservations, deals and contracts in one lifecycle",
  "Payment plans generated from the contract itself",
  "Tasks, approvals and documents on the record",
  "One source of truth, same numbers for every team",
  "Complete audited history of the business",
];

export const FLOW_BUSINESS = ["Lead", "Customer", "Unit", "Reservation", "Contract", "Payment plan", "Collection"];
export const FLOW_OPS = ["Tasks", "Workflows", "Approvals", "Documents"];
export const FLOW_INTEL = ["Analytics", "Insights", "AI Copilot"];

export interface DomainDef {
  num: string;
  name: string;
  body: string;
}

export const DOMAINS: DomainDef[] = [
  { num: "01", name: "CRM", body: "Leads, customers, activities, follow-ups and the complete sales pipeline." },
  { num: "02", name: "Properties", body: "Projects, buildings, floors, units, availability, pricing and inventory." },
  { num: "03", name: "Sales", body: "Reservations, deals, contracts and the full sales lifecycle." },
  { num: "04", name: "Finance", body: "Payment plans, installments, payments, collections, balances and commissions." },
  { num: "05", name: "Operations", body: "Tasks, workflows, approvals and document management." },
  { num: "06", name: "Analytics", body: "Sales performance, inventory movement, revenue, collections and team results." },
  { num: "07", name: "AI", body: "Copilot and generated insight that reads the company's own operational data." },
  { num: "08", name: "Administration", body: "Teams, roles, permissions, organization settings, notifications and audit activity." },
];

export const UNIT_FACTS = ["Availability", "Price", "Customer", "Agent", "Payment schedule", "Documents", "Activity timeline"];

export const CRM_TAGS = [
  "Lead management",
  "9-stage pipeline",
  "Lead scoring",
  "Activities",
  "Follow-ups",
  "Customer 360",
  "Interested units",
  "Reservations",
  "Deals",
  "Contracts",
];

export const FIN_TAGS = [
  "Payment schedules",
  "Due installments",
  "Payment tracking",
  "Outstanding balances",
  "Aging",
  "Collection performance",
  "Agent commissions",
];

export const PIPELINE_STAGES = [
  { name: "Qualified", value: "128", w: "88%" },
  { name: "Site visit", value: "96", w: "70%" },
  { name: "Negotiation", value: "61", w: "48%" },
  { name: "Reserved", value: "46", w: "36%" },
  { name: "Contracted", value: "31", w: "24%" },
];

export const COLLECTION_ROWS = [
  { unit: "B2-1104", customer: "N. Haddad", amount: "294,000", due: "−32d", color: RED },
  { unit: "C1-0902", customer: "Orbit Holdings", amount: "810,000", due: "−14d", color: RED },
  { unit: "A3-0407", customer: "R. Almeida", amount: "162,000", due: "−3d", color: AMBER },
  { unit: "D2-1501", customer: "Delta Family Office", amount: "1,150,000", due: "+6d", color: SECONDARY_TEXT },
  { unit: "B1-2210", customer: "K. Tanaka", amount: "338,000", due: "+11d", color: SECONDARY_TEXT },
];

export const OPS_ITEMS = [
  { name: "Tasks", note: "assigned, dated, on the record" },
  { name: "Workflows", note: "defined steps per process" },
  { name: "Workflow steps", note: "owner and condition" },
  { name: "Approvals", note: "discount, release, refund" },
  { name: "Documents", note: "contracts, IDs, receipts" },
  { name: "Activity history", note: "who changed what, when" },
];

export const ANALYTICS_TAGS = [
  "Sales performance",
  "Revenue",
  "Collections",
  "Inventory",
  "Lead conversion",
  "Sales velocity",
  "Project performance",
  "Agent performance",
  "Outstanding payments",
];

export const AI_ASKS = [
  "Which projects will miss Q4 collection targets?",
  "Show 2-bedroom units above 1,400 sqft still available in Tower B.",
  "Which agents' pipelines slowed this month?",
  "Summarise everything on the Orbit Holdings account.",
  "What should I act on before Thursday?",
];

export const LIFECYCLE_SOURCE: [string, string][] = [
  ["Capture", "A lead enters Atlas with source, project interest and score — no re-entry from another tool."],
  ["Convert", "The lead becomes a customer and an opportunity attached to the units they actually want."],
  ["Sell", "The unit is reserved, contracted and assigned. Inventory updates the moment it happens."],
  ["Collect", "The contract issues its payment plan; installments, payments and aging track themselves."],
  ["Operate", "Tasks, workflow steps, approvals and documents keep execution moving after the sale."],
  ["Understand", "Analytics read the same records — performance, velocity and exposure, current."],
  ["Act", "Copilot surfaces what changed, what it's worth, and the action that resolves it."],
];

export const NATIVE_OBJECTS = [
  "Projects",
  "Buildings",
  "Floors",
  "Units",
  "Unit availability",
  "Reservations",
  "Deals",
  "Contracts",
  "Payment plans",
  "Installments",
  "Collections",
  "Commissions",
];

export const TEAMS = [
  { role: "Executives", body: "The entire business from one command centre — sales, collections, inventory and risk." },
  { role: "Sales managers", body: "Pipeline, inventory, agent performance and approvals in a single view." },
  { role: "Sales agents", body: "Leads, customers, activities, available units and their own deals." },
  { role: "Finance teams", body: "Installments, payments, collections, aging and outstanding balances." },
  { role: "Operations teams", body: "Tasks, workflows, approvals and documents across every project." },
  { role: "Management", body: "Analytics and Copilot for faster, better-informed decisions." },
];

export const FOUNDATION = [
  { name: "Role-based access", body: "Permissions by team, project and record type." },
  { name: "Multi-tenant", body: "Multiple entities and companies on one foundation." },
  { name: "Auditability", body: "Every change attributed and retained." },
  { name: "Secure documents", body: "Contracts and IDs held against their records." },
  { name: "Centralised notifications", body: "One notification layer across every module." },
  { name: "Structured workflows", body: "Processes defined once, applied consistently." },
  { name: "Scalable foundation", body: "AURIC Core — built for growth, not migration." },
];
