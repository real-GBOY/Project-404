import { API_BASE_URL, ENDPOINTS, http } from "@/config";
import type { PresignResponse } from "@/lib/upload";
import type {
  Answer, AccountRequest, AuditQueryParams, AuditResult, ConfAccess, ConfGrant, ConfGrantee, ConfKind, ConfLogEntry, ConfMine, ConfReport, AnalyticsQueryParams, AnalyticsResult, SearchHit, CorrectiveAction, GuardHistory, GuardSummaries, TrainingReason, TrainingRequest, Observation, Report, ResponsibleOption, Severity, EvidenceItem, Form, FormSection, Inspection,
  AppNotification, CreateVisitInput, EligibleInspector, RescheduleVisitInput, Visit,
  Guard, LoginResponse, Me, OrgSettings, Person, PermissionsOverview, Project, RoleKey, TemplateChange,
} from "./types";

/**
 * The typed API layer — the ONLY place components' data comes from. Every function is a thin,
 * documented call to one backend route (no business rules, no URL building elsewhere). Hooks and
 * presenters depend on these; swapping transport or adding a mock for tests happens here.
 */
/** Analytics filters as a query string (empty values are left out; custom dates only apply to a custom period). */
function analyticsQs(q: AnalyticsQueryParams): string {
  const p = new URLSearchParams({ period: q.period });
  if (q.period === "custom") {
    if (q.from) p.set("from", q.from);
    if (q.to) p.set("to", q.to);
  }
  if (q.projectId) p.set("projectId", q.projectId);
  if (q.siteId) p.set("siteId", q.siteId);
  return p.toString();
}

function auditQs(q: AuditQueryParams): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  return p.toString();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      http<LoginResponse>(ENDPOINTS.auth.login, { method: "POST", body: { email, password }, anonymous: true }),
    logout: (refreshToken: string) =>
      http<void>(ENDPOINTS.auth.logout, { method: "POST", body: { refreshToken }, anonymous: true }),
  },
  me: () => http<Me>(ENDPOINTS.me),
  settings: {
    get: () => http<OrgSettings>(ENDPOINTS.settings),
    update: (settings: OrgSettings, reason: string) => http<OrgSettings>(ENDPOINTS.settings, { method: "PUT", body: { settings, reason } }),
  },
  permissions: {
    overview: () => http<PermissionsOverview>(ENDPOINTS.permissions),
    apply: (changes: TemplateChange[], reason: string) =>
      http<PermissionsOverview>(ENDPOINTS.permissions, { method: "PUT", body: { changes, reason } }),
  },
  users: {
    list: () => http<{ items: Person[] }>(ENDPOINTS.users.list).then((r) => r.items),
    get: (id: string) => http<Person>(ENDPOINTS.users.byId(id)),
    changeRole: (id: string, role: RoleKey, reason: string) => http<Person>(ENDPOINTS.users.role(id), { method: "PUT", body: { role, reason } }),
    setScope: (id: string, projectIds: string[], reason: string) =>
      http<Person>(ENDPOINTS.users.scope(id), { method: "PUT", body: { projectIds, reason } }),
    setStatus: (id: string, status: "active" | "disabled", reason: string) =>
      http<Person>(ENDPOINTS.users.status(id), { method: "POST", body: { status, reason } }),
  },
  projects: {
    list: () => http<{ items: Project[] }>(ENDPOINTS.projects.list).then((r) => r.items),
    get: (id: string) => http<Project>(ENDPOINTS.projects.byId(id)),
  },
  visits: {
    list: () => http<{ items: Visit[] }>(ENDPOINTS.visits.list).then((r) => r.items),
    get: (id: string) => http<Visit>(ENDPOINTS.visits.byId(id)),
    create: (input: CreateVisitInput) => http<Visit>(ENDPOINTS.visits.list, { method: "POST", body: input }),
    reschedule: (id: string, input: RescheduleVisitInput) => http<Visit>(ENDPOINTS.visits.reschedule(id), { method: "POST", body: input }),
    cancel: (id: string, reason: string) => http<Visit>(ENDPOINTS.visits.cancel(id), { method: "POST", body: { reason } }),
    eligibleInspectors: (projectId: string, date: string) =>
      http<{ items: EligibleInspector[] }>(ENDPOINTS.visits.inspectors, { query: { projectId, date } }).then((r) => r.items),
  },
  notifications: {
    list: () => http<{ notifications: AppNotification[]; unreadCount: number }>(ENDPOINTS.notifications.list, { query: { limit: 30 } }),
    markRead: (id: string) => http<void>(ENDPOINTS.notifications.read(id), { method: "POST" }),
    markAllRead: () => http<void>(ENDPOINTS.notifications.readAll, { method: "POST" }),
  },
  forms: {
    list: () => http<{ items: Form[] }>(ENDPOINTS.forms.list).then((r) => r.items),
    create: (b: { code: string; category: "site" | "guard"; name: { ar: string; en: string } }) => http<Form>(ENDPOINTS.forms.list, { method: "POST", body: b }),
    createDraft: (id: string) => http<Form>(ENDPOINTS.forms.versions(id), { method: "POST" }),
    saveDraft: (id: string, sections: FormSection[]) => http<Form>(ENDPOINTS.forms.draft(id), { method: "PUT", body: { sections } }),
    rename: (id: string, name: { ar: string; en: string }) => http<Form>(ENDPOINTS.forms.byId(id), { method: "PATCH", body: { name } }),
    discardDraft: (id: string) => http<Form>(ENDPOINTS.forms.draft(id), { method: "DELETE" }),
    publish: (id: string, reason: string) => http<Form>(ENDPOINTS.forms.publish(id), { method: "POST", body: { reason } }),
    setActive: (id: string, active: boolean, reason: string) => http<Form>(ENDPOINTS.forms.active(id), { method: "POST", body: { active, reason } }),
  },
  inspection: {
    get: (visitId: string) => http<Inspection>(ENDPOINTS.inspection.base(visitId)),
    start: (visitId: string) => http<Inspection>(ENDPOINTS.inspection.start(visitId), { method: "POST" }),
    answer: (visitId: string, itemId: string, patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null }) =>
      http<Inspection>(ENDPOINTS.inspection.answer(visitId, itemId), { method: "PUT", body: patch }),
    guardScore: (visitId: string, guardId: string, itemId: string, score: number) =>
      http<Inspection>(ENDPOINTS.inspection.guardScore(visitId, guardId, itemId), { method: "PUT", body: { score } }),
    guardNote: (visitId: string, guardId: string, note: string) => http<Inspection>(ENDPOINTS.inspection.guardNote(visitId, guardId), { method: "PUT", body: { note } }),
    submit: (visitId: string) => http<Inspection>(ENDPOINTS.inspection.submit(visitId), { method: "POST" }),
  },
  review: {
    decide: (visitId: string, action: "forward" | "return" | "reject" | "approve", body: { reason?: string; comment?: string; itemIds?: string[] }) =>
      http<Inspection>(ENDPOINTS.review(visitId, action), { method: "POST", body }),
  },
  evidence: {
    presign: (file: { name: string; type: string; size: number }) =>
      http<PresignResponse>(ENDPOINTS.files.presign, { method: "POST", body: { originalName: file.name, contentType: file.type || "application/octet-stream", byteSize: file.size } }),
    confirm: (fileId: string) => http<unknown>(ENDPOINTS.files.confirm(fileId), { method: "POST" }),
    attach: (b: { fileId: string; inspectionId?: string; actionId?: string; itemId?: string | null; guardId?: string | null }) => http<EvidenceItem>(ENDPOINTS.evidence.attach, { method: "POST", body: b }),
    remove: (id: string) => http<void>(ENDPOINTS.evidence.byId(id), { method: "DELETE" }),
    /** The bytes, fetched with the caller's credentials (never a public URL). */
    blob: async (id: string): Promise<Blob> => {
      const r = await fetch(`${API_BASE_URL}${ENDPOINTS.evidence.content(id)}`, { headers: http.bearerHeaders() });
      if (!r.ok) throw new Error(`evidence ${r.status}`);
      return r.blob();
    },
  },
  observations: {
    list: () => http<{ items: Observation[] }>(ENDPOINTS.observations.list).then((r) => r.items),
    create: (b: { projectId: string; siteId: string; text: string; note?: string; severity: Severity }) => http<Observation>(ENDPOINTS.observations.create, { method: "POST", body: b }),
  },
  actions: {
    list: () => http<{ items: CorrectiveAction[] }>(ENDPOINTS.actions.list).then((r) => r.items),
    get: (id: string) => http<CorrectiveAction>(ENDPOINTS.actions.byId(id)),
    responsible: (projectId: string) => http<{ items: ResponsibleOption[] }>(ENDPOINTS.actions.responsible(projectId)).then((r) => r.items),
    create: (observationId: string, b: { responsibleId: string; dueDate: string; priority: Severity; description: string }) =>
      http<CorrectiveAction>(ENDPOINTS.observations.action(observationId), { method: "POST", body: b }),
    step: (id: string, step: "start" | "submit" | "return" | "close", body: { reason?: string; comment?: string } = {}) =>
      http<CorrectiveAction>(ENDPOINTS.actions.step(id, step), { method: "POST", body }),
    comment: (id: string, text: string) => http<CorrectiveAction>(ENDPOINTS.actions.comments(id), { method: "POST", body: { text } }),
  },
  training: {
    list: () => http<{ items: TrainingRequest[] }>(ENDPOINTS.training.list).then((r) => r.items),
    get: (id: string) => http<TrainingRequest>(ENDPOINTS.training.byId(id)),
    create: (b: { guardId: string; reason: TrainingReason; course: string; related: string; priority: Severity; notes: string }) =>
      http<TrainingRequest>(ENDPOINTS.training.list, { method: "POST", body: b }),
    step: (id: string, step: "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete", body: Record<string, unknown> = {}) =>
      http<TrainingRequest>(ENDPOINTS.training.step(id, step), { method: "POST", body }),
  },
  guardHistory: (id: string) => http<GuardHistory>(ENDPOINTS.guardHistory(id)),
  guardSummary: () => http<{ items: GuardSummaries }>(ENDPOINTS.guardSummary).then((r) => r.items),
  analytics: {
    get: (q: AnalyticsQueryParams) => http<AnalyticsResult>(ENDPOINTS.analytics(analyticsQs(q))),
    exportCsv: async (q: AnalyticsQueryParams): Promise<Blob> => {
      const r = await fetch(`${API_BASE_URL}${ENDPOINTS.analyticsExport(analyticsQs(q))}`, { headers: http.bearerHeaders() });
      if (!r.ok) throw new Error(`export ${r.status}`);
      return r.blob();
    },
  },
  search: (q: string) => http<{ items: SearchHit[] }>(ENDPOINTS.search(q)).then((r) => r.items),
  conf: {
    access: () => http<ConfAccess>(`${ENDPOINTS.conf.base}/access`),
    mine: () => http<{ items: ConfMine[] }>(`${ENDPOINTS.conf.base}/mine`).then((r) => r.items),
    submit: (b: { kind: ConfKind; subject: string; body: string; place: string; identity: "named" | "confidential" | "anonymous"; fileIds: string[] }) =>
      http<{ id: string | null; ref: string }>(`${ENDPOINTS.conf.base}/reports`, { method: "POST", body: b }),
    enter: (reason: string, ack: boolean) => http<{ until: string }>(`${ENDPOINTS.conf.base}/session`, { method: "POST", body: { reason, ack } }),
    exit: () => http<void>(`${ENDPOINTS.conf.base}/session/exit`, { method: "POST" }),
    list: () => http<{ items: ConfReport[] }>(`${ENDPOINTS.conf.base}/reports`).then((r) => r.items),
    get: (id: string) => http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}`),
    respond: (id: string, text: string) => http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}/respond`, { method: "POST", body: { text } }),
    reveal: (id: string, reason: string) => http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}/reveal`, { method: "POST", body: { reason } }),
    grants: () => http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants`).then((r) => r.items),
    grantees: () => http<{ items: ConfGrantee[] }>(`${ENDPOINTS.conf.base}/grantees`).then((r) => r.items),
    issue: (b: { userId: string; level: "view" | "respond"; scope: "all" | "standard"; reason: string; expiresAt: string }) => http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants`, { method: "POST", body: b }),
    revoke: (id: string, reason: string) => http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants/${id}/revoke`, { method: "POST", body: { reason } }),
    log: () => http<{ items: ConfLogEntry[] }>(`${ENDPOINTS.conf.base}/log`).then((r) => r.items),
  },
  audit: {
    list: (q: AuditQueryParams) => http<AuditResult>(ENDPOINTS.audit(auditQs(q))),
    exportCsv: async (q: AuditQueryParams): Promise<Blob> => {
      const r = await fetch(`${API_BASE_URL}${ENDPOINTS.auditExport(auditQs(q))}`, { headers: http.bearerHeaders() });
      if (!r.ok) throw new Error(`export ${r.status}`);
      return r.blob();
    },
  },
  accountRequests: {
    list: () => http<{ items: AccountRequest[] }>(ENDPOINTS.accountRequests.list).then((r) => r.items),
    get: (id: string) => http<AccountRequest>(ENDPOINTS.accountRequests.byId(id)),
    approve: (id: string, b: { role: string; projectIds: string[]; comment?: string }) => http<AccountRequest>(ENDPOINTS.accountRequests.step(id, "approve"), { method: "POST", body: b }),
    reject: (id: string, reason: string) => http<AccountRequest>(ENDPOINTS.accountRequests.step(id, "reject"), { method: "POST", body: { reason } }),
    resend: (id: string) => http<void>(ENDPOINTS.accountRequests.step(id, "resend"), { method: "POST" }),
  },
  reports: {
    list: () => http<{ items: Report[]; pdf: boolean }>(ENDPOINTS.reports.list),
    /** The rendered PDF, fetched with the caller's credentials. */
    pdf: async (id: string, lang: "ar" | "en"): Promise<Blob> => {
      const r = await fetch(`${API_BASE_URL}${ENDPOINTS.reports.pdf(id, lang)}`, { headers: http.bearerHeaders() });
      if (!r.ok) throw Object.assign(new Error(`pdf ${r.status}`), { status: r.status });
      return r.blob();
    },
  },
  guards: {
    list: () => http<{ items: Guard[] }>(ENDPOINTS.guards.list).then((r) => r.items),
  },
};
