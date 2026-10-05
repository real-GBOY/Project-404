import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { Person, RoleKey } from "../types";

export const usersApi = {
  list: () => allPages<Person>(ENDPOINTS.users.list).then((r) => r.items),
  get: (id: string) => http<Person>(ENDPOINTS.users.byId(id)),
  changeRole: (id: string, role: RoleKey, reason: string) =>
    http<Person>(ENDPOINTS.users.role(id), { method: "PUT", body: { role, reason } }),
  setScope: (id: string, projectIds: string[], reason: string) =>
    http<Person>(ENDPOINTS.users.scope(id), { method: "PUT", body: { projectIds, reason } }),
  setStatus: (id: string, status: "active" | "disabled", reason: string) =>
    http<Person>(ENDPOINTS.users.status(id), { method: "POST", body: { status, reason } }),
};
