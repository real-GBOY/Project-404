import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { L10n, Person, RoleKey } from "../types";

export const usersApi = {
  list: () => allPages<Person>(ENDPOINTS.users.list).then((r) => r.items),
  get: (id: string) => http<Person>(ENDPOINTS.users.byId(id)),
  changeRole: (id: string, role: RoleKey, reason: string) =>
    http<Person>(ENDPOINTS.users.role(id), { method: "PUT", body: { role, reason } }),
  setScope: (id: string, projectIds: string[], reason: string) =>
    http<Person>(ENDPOINTS.users.scope(id), { method: "PUT", body: { projectIds, reason } }),
  setStatus: (id: string, status: "active" | "disabled", reason: string) =>
    http<Person>(ENDPOINTS.users.status(id), { method: "POST", body: { status, reason } }),
  updateProfile: (
    id: string,
    patch: { name?: L10n; title?: L10n; phone?: string | null; employeeNo?: string | null },
  ) => http<Person>(ENDPOINTS.users.byId(id), { method: "PATCH", body: patch }),
  /** Clears a person's second factor (lost device and recovery codes). */
  resetMfa: (id: string, reason: string) =>
    http<void>(ENDPOINTS.users.mfaReset(id), { method: "POST", body: { reason } }),
  /** Everything held about one person, for a data-subject request. */
  personalData: (id: string) => http<unknown>(ENDPOINTS.users.personalData(id)),
};
