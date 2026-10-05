/**
 * Domain types: the resources the backend returns (raqib/backend/app/raqib/*). The backend is
 * authoritative — these are what the UI consumes and displays, never what it owns.
 */
export type Lang = "ar" | "en";
export interface L10n {
  ar: string;
  en: string;
}

export type RoleKey = "qm" | "qe" | "pm" | "ins" | "gs" | "guard" | "gm";
export type ModuleKey =
  | "projects" | "visits" | "inspections" | "guardEval" | "observations" | "actions" | "training"
  | "reports" | "analytics" | "forms" | "users" | "permissions" | "audit" | "settings";
export type Template = Record<ModuleKey, string>;

export type PersonStatus = "active" | "invited" | "disabled";
export interface Person {
  id: string;
  name: L10n;
  ini: L10n;
  role: RoleKey;
  title: L10n;
  email: string;
  employeeNo: string | null;
  status: PersonStatus;
  lastActiveAt: string | null;
  /** `"all"` or the active assigned project ids. */
  scope: "all" | string[];
}
/** `/raqib/me` — the signed-in person plus their effective permission template. */
export interface Me extends Person {
  permissions: Template;
  organizationId: string;
  /** The organization's business date (YYYY-MM-DD). */
  today: string;
}

export type ProjectStatus = "active" | "attention" | "mobilizing";
export interface Area {
  id: string;
  name: L10n;
}
export interface Site {
  id: string;
  name: L10n;
  areas: Area[];
}
export interface Project {
  id: string;
  code: string;
  name: L10n;
  city: L10n;
  region: L10n;
  manager: { id: string; name: L10n } | null;
  status: ProjectStatus;
  firstVisitDate: string | null;
  guardCount: number;
  sites: Site[];
}
export interface Guard {
  id: string;
  projectId: string;
  employeeNo: string;
  nationalId: string;
  name: L10n;
  post: L10n;
  shift: "morning" | "evening" | "night";
  status: "active" | "inactive";
  userId: string | null;
}

export interface OrgSettings {
  org: { nameAr: string; nameEn: string; cr: string; cityAr: string; cityEn: string; lang: Lang; tz: string };
  scoring: { high: number; mid: number; naExcluded: boolean; criticalFail: boolean };
  insp: { latestOnStart: boolean; publishNeedsApproval: boolean; ncNote: boolean; ncEvidence: boolean; lockAfterSubmit: boolean; overdueHours: number };
  attach: { photo: number; video: number; doc: number; types: string; videoProtected: boolean; linkMinutes: number; retention: number; compress: boolean };
  notif: Record<string, [number, number]>;
  report: { lang: "both" | Lang; branding: boolean; evidence: boolean; signatures: boolean; history: boolean; watermark: boolean };
  security: { session: number; mfa: string; pwLen: number; pwRotate: number; lockout: number };
  audit: { retention: number; exportRoles: string };
}

export interface PermissionsOverview {
  roles: Record<RoleKey, Template>;
  defaults: Record<RoleKey, Template>;
  modules: ModuleKey[];
  actions: string[];
  applicable: Record<ModuleKey, string>;
}
export interface TemplateChange {
  role: RoleKey;
  module: ModuleKey;
  actions: string;
}

export interface LoginResponse {
  user: { id: string; email: string };
  tokens: { accessToken: string; refreshToken: string };
}

export type VisitType = "routine" | "surprise" | "follow" | "night";
export type Shift = "morning" | "evening" | "night";
export type VisitStatus =
  | "scheduled" | "assigned" | "in_progress" | "pending_review" | "pending_approval" | "returned" | "approved" | "rejected" | "cancelled";
/** `overdue` is derived by the backend from the schedule; it is never a stored status. */
export type DisplayStatus = VisitStatus | "overdue";

export interface VisitHistoryEntry {
  action: string;
  from: string | null;
  to: string;
  at: string;
  reason: string | null;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}
export interface Visit {
  id: string;
  ref: string;
  project: { id: string; code: string; name: L10n };
  site: { id: string; name: L10n };
  area: L10n | string | null;
  inspector: { id: string; name: L10n; ini: L10n } | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  status: DisplayStatus;
  storedStatus: VisitStatus;
  round: number;
  guardIds: string[];
  history: VisitHistoryEntry[];
  createdAt: string;
}
export interface CreateVisitInput {
  projectId: string;
  siteId: string;
  areaText?: string | null;
  inspectorId?: string | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  reason: string;
}
export interface RescheduleVisitInput {
  date: string;
  time: string;
  inspectorId?: string | null;
  reason: string;
}
export interface EligibleInspector {
  id: string;
  name: L10n;
  ini: L10n;
}

/** A Core in-app notification (`GET /notifications`). `data.go` is `[route, id]` for the screen it concerns. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { go?: [string, string | null] } | null;
  read: boolean;
  createdAt: string;
}
