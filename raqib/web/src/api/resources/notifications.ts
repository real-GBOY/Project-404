import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { AppNotification } from "../types";

export const notificationsApi = {
  list: () =>
    http<{ notifications: AppNotification[]; unreadCount: number }>(ENDPOINTS.notifications.list, {
      query: { limit: 30 },
    }),
  markRead: (id: string) => http<void>(ENDPOINTS.notifications.read(id), { method: "POST" }),
  markAllRead: () => http<void>(ENDPOINTS.notifications.readAll, { method: "POST" }),
};
