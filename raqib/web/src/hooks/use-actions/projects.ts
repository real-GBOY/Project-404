import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Projects, their sites and areas, and the guard roster. Anything that changes a project also re-reads the visits that name it. */
export const projectActions = (
  qc: Qc,
): Slice<
  | "createProject"
  | "updateProject"
  | "addSite"
  | "renameSite"
  | "archiveSite"
  | "addArea"
  | "archiveArea"
  | "createGuard"
  | "updateGuard"
  | "setGuardStatus"
> => ({
  async createProject(input) {
    await api.projects.create(input);
    await invalidate(qc, QK.projects);
  },
  async updateProject(id, patch) {
    await api.projects.update(id, patch);
    await invalidate(qc, QK.projects, QK.visits);
  },
  async addSite(projectId, name) {
    await api.projects.addSite(projectId, name);
    await invalidate(qc, QK.projects);
  },
  async renameSite(id, name) {
    await api.projects.renameSite(id, name);
    await invalidate(qc, QK.projects, QK.visits);
  },
  async archiveSite(id) {
    await api.projects.archiveSite(id);
    await invalidate(qc, QK.projects);
  },
  async addArea(siteId, name) {
    await api.projects.addArea(siteId, name);
    await invalidate(qc, QK.projects);
  },
  async archiveArea(id) {
    await api.projects.archiveArea(id);
    await invalidate(qc, QK.projects);
  },
  async createGuard(input) {
    await api.guards.create(input);
    await invalidate(qc, QK.guards, QK.projects, QK.guardSummary);
  },
  async updateGuard(id, patch) {
    await api.guards.update(id, patch);
    await invalidate(qc, QK.guards, QK.projects, QK.guardSummary);
  },
  async setGuardStatus(id, status) {
    await api.guards.setStatus(id, status);
    await invalidate(qc, QK.guards, QK.projects);
  },
});
