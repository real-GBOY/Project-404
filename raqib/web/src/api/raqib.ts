import { ENDPOINTS, http } from "@/config";
import type {
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
  guards: {
    list: () => http<{ items: Guard[] }>(ENDPOINTS.guards.list).then((r) => r.items),
  },
};
