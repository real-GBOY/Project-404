import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Users, permission templates and organization settings. */
export const adminActions = (
  qc: Qc,
): Slice<"changeRole" | "setScope" | "setStatus" | "applyTemplates" | "saveSettings"> => ({
  async changeRole(id, role, reason) {
    await api.users.changeRole(id, role, reason);
    await invalidate(qc, QK.users);
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
