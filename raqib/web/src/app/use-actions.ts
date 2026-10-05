import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/raqib";
import type { Actions } from "@/presenters/actions";

/**
 * The application layer: each command calls the API, then invalidates exactly the server state it can have
 * changed (so every screen re-reads from the backend rather than patching local copies).
 */
export function useActions(): Actions {
  const qc = useQueryClient();
  return useMemo<Actions>(
    () => ({
      async changeRole(id, role, reason) {
        await api.users.changeRole(id, role, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async setScope(id, projectIds, reason) {
        await api.users.setScope(id, projectIds, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async setStatus(id, status, reason) {
        await api.users.setStatus(id, status, reason);
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async applyTemplates(changes, reason) {
        await api.permissions.apply(changes, reason);
        await qc.invalidateQueries({ queryKey: ["permissions"] });
        await qc.invalidateQueries({ queryKey: ["users"] });
      },
      async saveSettings(settings, reason) {
        await api.settings.update(settings, reason);
        await qc.invalidateQueries({ queryKey: ["settings"] });
      },
      async createVisit(input) {
        const v = await api.visits.create(input);
        await qc.invalidateQueries({ queryKey: ["visits"] });
        return { ref: v.ref, id: v.id };
      },
      async rescheduleVisit(id, input) {
        await api.visits.reschedule(id, input);
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async cancelVisit(id, reason) {
        await api.visits.cancel(id, reason);
        await qc.invalidateQueries({ queryKey: ["visits"] });
      },
      async markNotificationRead(id) {
        await api.notifications.markRead(id);
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      },
      async markAllNotificationsRead() {
        await api.notifications.markAllRead();
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      },
    }),
    [qc],
  );
}
