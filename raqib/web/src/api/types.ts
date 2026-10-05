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
  scorePct: number | null;
  inspectionId: string | null;
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

export type ItemType = "cnx" | "yesno" | "number" | "text" | "select" | "date" | "scale5";
export interface FormItem {
  key: string;
  text: L10n;
  weight: number;
  type: ItemType;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
}
export interface FormSection {
  key: string;
  title: L10n;
  items: FormItem[];
}
export type FormChange =
  | { kind: "added"; num: string; text: L10n }
  | { kind: "removed"; num: string; text: L10n }
  | { kind: "weight"; num: string; from: number; to: number }
  | { kind: "text"; num: string }
  | { kind: "rules"; num: string }
  | { kind: "sections"; from: number; to: number };
export interface FormVersion {
  id: string;
  version: string;
  status: "draft" | "published" | "archived";
  note: L10n;
  at: string;
  by: { id: string; name: L10n } | null;
  uses: number;
  sections: FormSection[];
}
export interface Form {
  id: string;
  code: string;
  category: "site" | "guard";
  name: L10n;
  description: L10n;
  active: boolean;
  isDefault: boolean;
  updatedAt: string;
  versions: FormVersion[];
  diff: FormChange[];
}

export type Answer = "c" | "n" | "x" | null;
export interface EvidenceItem {
  id: string;
  name: string;
  kind: "photo" | "video" | "doc";
  mime: string;
  sizeBytes: number;
  at: string;
  by: string | null;
}
export interface InspectionItem {
  id: string;
  key: string;
  num: string;
  text: L10n;
  weight: number;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
  answer: Answer;
  note: string;
  severity: "low" | "medium" | "high" | null;
  evidence: EvidenceItem[];
  flagged: boolean;
  fixed: boolean;
  locked: boolean;
}
export interface GuardEvaluation {
  guardId: string;
  scores: Record<string, number>;
  note: string;
  evidence: EvidenceItem[];
  pct: number | null;
  done: boolean;
  answered: number;
}
export interface InspectionIssue {
  code: "unanswered" | "note_required" | "evidence_required" | "evidence_pending" | "flag_untouched" | "guard_incomplete";
  at: string;
  step: number;
}
export interface Inspection {
  id: string;
  visitId: string;
  ref: string;
  status: string;
  round: number;
  form: { versionId: string; code: string; version: string; name: L10n };
  sections: Array<{ key: string; title: L10n; items: InspectionItem[] }>;
  guardCriteria: Array<{ id: string; key: string; text: L10n }>;
  guards: GuardEvaluation[];
  previous: Array<{ round: number; itemIds: string[] }>;
  score: { pct: number | null; answered: number; total: number; compliant: number; nonCompliant: number; na: number; evidence: number };
  issues: InspectionIssue[];
  editable: boolean;
  submittedAt: string | null;
  startedAt: string;
}

export interface ReportSnapshot {
  version: 1;
  ref: string;
  visitRef: string;
  issuedAt: string;
  project: { code: string; name: L10n };
  site: L10n;
  area: L10n | string | null;
  type: string;
  shift: string;
  date: string;
  time: string;
  inspector: L10n | null;
  form: { code: string; version: string; name: L10n };
  round: number;
  score: { pct: number | null; compliant: number; nonCompliant: number; na: number; evidence: number };
  sections: Array<{ title: L10n; items: Array<{ num: string; text: L10n; weight: number; answer: string | null; note: string; evidence: Array<{ id: string; name: string; kind: string; mime: string }> }> }>;
  guards: Array<{ employeeNo: string; name: L10n; pct: number | null; note: string }>;
  decisions: Array<{ action: string; at: string; reason: string | null; actor: { name: L10n; title: L10n; role: string | null } }>;
  approvedBy: { name: L10n; title: L10n };
}

export interface Report {
  id: string;
  ref: string;
  visitId: string;
  projectId: string;
  scorePct: number | null;
  issuedAt: string;
  snapshot: ReportSnapshot;
}

export type Severity = "low" | "medium" | "high";
export type ActionStatus = "assigned" | "in_progress" | "quality_review" | "returned" | "closed";
export type ActionDisplayStatus = ActionStatus | "overdue";

export interface Observation {
  id: string;
  ref: string;
  kind: "violation" | "observation";
  title: L10n;
  note: string;
  severity: Severity;
  repeatCount: number;
  project: { id: string; code: string; name: L10n };
  site: L10n;
  visit: { id: string; ref: string } | null;
  itemNum: string | null;
  itemKey: string | null;
  reportedBy: L10n;
  createdAt: string;
  action: { id: string; ref: string; status: ActionDisplayStatus; dueDate: string; priority: Severity; responsible: L10n } | null;
}

export interface ActionLogEntry {
  id: string;
  kind: "created" | "started" | "submitted" | "comment" | "returned" | "closed" | "reassigned";
  from: string | null;
  to: string | null;
  text: string | null;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}

export interface CorrectiveAction {
  id: string;
  ref: string;
  title: L10n;
  description: string;
  priority: Severity;
  status: ActionDisplayStatus;
  storedStatus: ActionStatus;
  dueDate: string;
  round: number;
  project: { id: string; code: string; name: L10n };
  responsible: { id: string; name: L10n };
  observation: { id: string; ref: string; kind: string; severity: Severity; repeatCount: number; itemNum: string | null; site: L10n };
  visit: { id: string; ref: string } | null;
  createdAt: string;
  closedAt: string | null;
  log?: ActionLogEntry[];
  evidence?: EvidenceItem[];
}

export interface ResponsibleOption {
  id: string;
  name: L10n;
  title: L10n;
}

export type TrainingStatus = "pending_pm" | "returned" | "rejected" | "approved" | "scheduled" | "completed";
export type TrainingReason = "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment";
export type TrainingResult = "passed" | "attended" | "failed";

export interface TrainingRequest {
  id: string;
  ref: string;
  guard: { id: string; employeeNo: string; name: L10n };
  project: { id: string; code: string; name: L10n };
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Severity;
  notes: string;
  status: TrainingStatus;
  round: number;
  escalated: boolean;
  requestedBy: L10n | null;
  requestedById: string | null;
  scheduledDate: string | null;
  provider: string | null;
  completedDate: string | null;
  result: TrainingResult | null;
  resultNote: string | null;
  createdAt: string;
  log?: Array<{ id: string; kind: string; to: string; text: string | null; at: string; actor: { id: string | null; name: L10n; role: string | null; title: L10n } }>;
}

export interface GuardHistory {
  guard: { id: string; employeeNo: string; name: L10n; post: L10n };
  evaluations: Array<{ reportId: string; reportRef: string; visitId: string; visitRef: string; date: string; pct: number | null; note: string; site: L10n }>;
  average: number | null;
  training: TrainingRequest[];
}

export type GuardSummaries = Record<string, { average: number | null; evaluations: number; lastPct: number | null }>;
