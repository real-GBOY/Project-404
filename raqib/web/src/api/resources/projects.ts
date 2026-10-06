import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { L10n, Project, ProjectInput } from "../types";

export const projectsApi = {
  list: () => http<{ items: Project[] }>(ENDPOINTS.projects.list).then((r) => r.items),
  get: (id: string) => http<Project>(ENDPOINTS.projects.byId(id)),
  create: (input: ProjectInput) =>
    http<Project>(ENDPOINTS.projects.list, { method: "POST", body: input }),
  /** The project code is fixed once created (reports and references carry it), so it is not part of an edit. */
  update: (id: string, patch: Partial<Omit<ProjectInput, "code">>) =>
    http<Project>(ENDPOINTS.projects.byId(id), { method: "PATCH", body: patch }),
  addSite: (projectId: string, name: L10n) =>
    http<Project>(ENDPOINTS.projects.sites(projectId), { method: "POST", body: { name } }),
  renameSite: (id: string, name: L10n) =>
    http<Project>(ENDPOINTS.sites.byId(id), { method: "PATCH", body: { name } }),
  archiveSite: (id: string) => http<Project>(ENDPOINTS.sites.byId(id), { method: "DELETE" }),
  addArea: (siteId: string, name: L10n) =>
    http<Project>(ENDPOINTS.sites.areas(siteId), { method: "POST", body: { name } }),
  archiveArea: (id: string) => http<Project>(ENDPOINTS.areas.byId(id), { method: "DELETE" }),
};
