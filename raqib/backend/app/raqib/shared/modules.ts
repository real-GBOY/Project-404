/**
 * The Raqib permission model: a role template maps each MODULE to a set of ACTION letters.
 * (Mirrors the approved design's matrix.) The conceptual `visits.read / inspections.approve`
 * style keys are exactly (module, letter): V = read, A = create, E = update, S = submit,
 * R = review, P = approve, D = download, X = export.
 *
 * Confidential reports are deliberately NOT a module here — their access is an explicit grant.
 */
export const ACTIONS = ["V", "A", "E", "S", "R", "P", "D", "X"] as const;
export type ActionLetter = (typeof ACTIONS)[number];

export const MODULES = [
  "projects",
  "visits",
  "inspections",
  "guardEval",
  "observations",
  "actions",
  "training",
  "reports",
  "analytics",
  "forms",
  "users",
  "permissions",
  "audit",
  "settings",
] as const;
export type ModuleKey = (typeof MODULES)[number];

/** Which letters make sense per module (the editor cannot grant an inapplicable letter). */
export const APPLICABLE: Record<ModuleKey, string> = {
  projects: "VAEDX",
  visits: "VAEDX",
  inspections: "VAESRPDX",
  guardEval: "VAESRPX",
  observations: "VAEX",
  actions: "VAESRPX",
  training: "VAESRPX",
  reports: "VADX",
  analytics: "VX",
  forms: "VAEPX",
  users: "VAEPX",
  permissions: "VE",
  audit: "VX",
  settings: "VE",
};

export const ROLE_KEYS = ["qm", "qe", "pm", "ins", "gs", "guard", "gm"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export type Template = Record<ModuleKey, string>;

const none = (): Template => Object.fromEntries(MODULES.map((m) => [m, ""])) as Template;

/** Built-in defaults (the approved design's starting templates). An organization overrides per module. */
export const DEFAULT_TEMPLATES: Record<RoleKey, Template> = {
  qm: { ...none(), projects: "VAEDX", visits: "VAEDX", inspections: "VERPDX", guardEval: "VRPX", observations: "VAEX", actions: "VAERPX", training: "VERPX", reports: "VADX", analytics: "VX", forms: "VAEPX", users: "VAEPX", permissions: "VE", audit: "VX", settings: "VE" },
  qe: { ...none(), projects: "VD", visits: "VAED", inspections: "VRD", guardEval: "VR", observations: "VAE", actions: "VAER", training: "VR", reports: "VAD", analytics: "V", forms: "VAE" },
  pm: { ...none(), projects: "VD", visits: "V", inspections: "VD", observations: "V", actions: "VES", training: "VP", reports: "VADX", analytics: "VX" },
  ins: { ...none(), visits: "V", inspections: "VAES", guardEval: "VAES", observations: "A" },
  gs: { ...none(), guardEval: "V", observations: "V", training: "VAES" },
  guard: none(),
  gm: { ...none(), projects: "V", reports: "VDX", analytics: "VX", audit: "VX" },
};

/** Roles whose project scope is every project in the organization (no assignment rows needed). */
export const ALL_PROJECT_ROLES: readonly RoleKey[] = ["qm", "gm"];

export const isRoleKey = (v: string): v is RoleKey => (ROLE_KEYS as readonly string[]).includes(v);
export const isModule = (v: string): v is ModuleKey => (MODULES as readonly string[]).includes(v);
