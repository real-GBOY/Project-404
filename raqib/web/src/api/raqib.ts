import { API_BASE_URL, ENDPOINTS, http } from "@/config";
import type { PresignResponse } from "@/lib/upload";
import type {
  Answer, EvidenceItem, Form, FormSection, Inspection,
  AppNotification, CreateVisitInput, EligibleInspector, RescheduleVisitInput, Visit,
  Guard, LoginResponse, Me, OrgSettings, Person, PermissionsOverview, Project, RoleKey, TemplateChange,
} from "./types";

/**
 * The typed API layer — the ONLY place components' data comes from. Every function is a thin,
 * documented call to one backend route (no business rules, no URL building elsewhere). Hooks and
 * presenters depend on these; swapping transport or adding a mock for tests happens here.
 */
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
  evidence: {
    presign: (file: { name: string; type: string; size: number }) =>
      http<PresignResponse>(ENDPOINTS.files.presign, { method: "POST", body: { originalName: file.name, contentType: file.type || "application/octet-stream", byteSize: file.size } }),
    confirm: (fileId: string) => http<unknown>(ENDPOINTS.files.confirm(fileId), { method: "POST" }),
    attach: (b: { fileId: string; inspectionId: string; itemId?: string | null; guardId?: string | null }) => http<EvidenceItem>(ENDPOINTS.evidence.attach, { method: "POST", body: b }),
    remove: (id: string) => http<void>(ENDPOINTS.evidence.byId(id), { method: "DELETE" }),
    /** The bytes, fetched with the caller's credentials (never a public URL). */
    blob: async (id: string): Promise<Blob> => {
      const r = await fetch(`${API_BASE_URL}${ENDPOINTS.evidence.content(id)}`, { headers: http.bearerHeaders() });
      if (!r.ok) throw new Error(`evidence ${r.status}`);
      return r.blob();
    },
  },
  guards: {
    list: () => http<{ items: Guard[] }>(ENDPOINTS.guards.list).then((r) => r.items),
  },
};
