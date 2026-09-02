import { httpClient } from "@/lib/api/http-client";
import type { NotificationList, NotificationListParams } from "../types/notification";

/** `GET /api/notifications` (real endpoint — not mocked; PLAN §5). */
export function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<NotificationList> {
  return httpClient<NotificationList>("/notifications", {
    query: { unread: params.unread, cursor: params.cursor },
    signal,
  });
}

/** `POST /api/notifications/:id/read`. */
export function markNotificationRead(id: string): Promise<void> {
  return httpClient<void>(`/notifications/${id}/read`, { method: "POST" });
}

/** `POST /api/notifications/read-all`. */
export function markAllNotificationsRead(): Promise<void> {
  return httpClient<void>("/notifications/read-all", { method: "POST" });
}
