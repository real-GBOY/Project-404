import { api } from "@/api";
import { QK } from "../query-keys";
import { invalidate, type Qc, type Slice } from "./shared";

/** Scheduling, and the notification bell. */
export const visitActions = (
  qc: Qc,
): Slice<
  | "createVisit"
  | "rescheduleVisit"
  | "cancelVisit"
  | "markNotificationRead"
  | "markAllNotificationsRead"
> => ({
  async createVisit(input) {
    const v = await api.visits.create(input);
    await invalidate(qc, QK.visits);
    return { ref: v.ref, id: v.id };
  },
  async rescheduleVisit(id, input) {
    await api.visits.reschedule(id, input);
    await invalidate(qc, QK.visits);
  },
  async cancelVisit(id, reason) {
    await api.visits.cancel(id, reason);
    await invalidate(qc, QK.visits);
  },
  async markNotificationRead(id) {
    await api.notifications.markRead(id);
    await invalidate(qc, QK.notifications);
  },
  async markAllNotificationsRead() {
    await api.notifications.markAllRead();
    await invalidate(qc, QK.notifications);
  },
});
