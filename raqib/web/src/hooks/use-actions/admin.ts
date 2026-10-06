import { api } from "@/api";
import { saveBlob } from "@/presenters/screens/reports";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Users, permission templates and organization settings. */
export const adminActions = (
  qc: Qc,
): Slice<
  | "changeRole"
  | "updateProfile"
  | "resetMfa"
  | "exportPersonalData"
  | "setScope"
  | "setStatus"
  | "applyTemplates"
  | "saveSettings"
> => ({
  async changeRole(id, role, reason) {
    await api.users.changeRole(id, role, reason);
    await invalidate(qc, QK.users);
  },
  async updateProfile(id, patch) {
    await api.users.updateProfile(id, patch);
    await invalidate(qc, QK.users);
  },
  async resetMfa(id, reason) {
    await api.users.resetMfa(id, reason);
  },
  async exportPersonalData(id, fileName) {
    const data = await api.users.personalData(id);
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), fileName);
  },
  async setScope(id, projectIds, reason) {
    await api.users.setScope(id, projectIds, reason);
    await invalidate(qc, QK.users);
  },
  async setStatus(id, status, reason) {
    await api.users.setStatus(id, status, reason);
    await invalidate(qc, QK.users);
  },
  async applyTemplates(changes, reason) {
    await api.permissions.apply(changes, reason);
    await invalidate(qc, QK.permissions, QK.users);
  },
  async saveSettings(settings, reason) {
    await api.settings.update(settings, reason);
    await invalidate(qc, QK.settings);
  },
});
