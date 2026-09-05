import { httpClient } from "@/lib/api/http-client";
import type { NotificationList, NotificationListParams } from "./types";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: NotificationListParams = {}) => [...notificationKeys.all, "list", params] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

/** `GET /api/lawfirm/notifications` — the same law-firm adapter route the
 *  web app calls (not Core's raw `/notifications`). */
export function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<NotificationList> {
  return httpClient<NotificationList>("/lawfirm/notifications", {
    query: { unread: params.unread, cursor: params.cursor },
    signal,
  });
}

export function markNotificationRead(id: string): Promise<void> {
  return httpClient<void>(`/lawfirm/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<void> {
  return httpClient<void>("/lawfirm/notifications/read-all", { method: "POST" });
}
