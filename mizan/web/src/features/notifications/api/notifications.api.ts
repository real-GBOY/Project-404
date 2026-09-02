import { httpClient } from "@/lib/api/http-client";
import type { NotificationList, NotificationListParams } from "../types/notification";

/**
 * `GET /api/lawfirm/notifications` — the law-firm adapter over Core
 * `core/notifications`, reshaped to `NotificationList` (`items`, `readAt`,
 * derived `href`). Core is not modified.
 */
export function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<NotificationList> {
  return httpClient<NotificationList>("/lawfirm/notifications", {
    query: { unread: params.unread, cursor: params.cursor },
    signal,
  });
}

/** `POST /api/lawfirm/notifications/:id/read`. */
export function markNotificationRead(id: string): Promise<void> {
  return httpClient<void>(`/lawfirm/notifications/${id}/read`, { method: "POST" });
}

/** `POST /api/lawfirm/notifications/read-all`. */
export function markAllNotificationsRead(): Promise<void> {
  return httpClient<void>("/lawfirm/notifications/read-all", { method: "POST" });
}
