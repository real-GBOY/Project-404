import type { Paginated } from "@/types/api";

/** A single in-app notification (backend `core/notifications`). */
export interface AppNotification {
  id: string;
  /** dotted event key, e.g. `hearing.scheduled` */
  type: string;
  title: string;
  body: string | null;
  /** ISO timestamp, or null while unread */
  readAt: string | null;
  createdAt: string;
  /** optional deep-link target within the app */
  href?: string;
  data?: Record<string, unknown>;
}

/** `GET /api/notifications` — keyset page plus a total unread count. */
export type NotificationList = Paginated<AppNotification> & { unreadCount?: number };

export interface NotificationListParams {
  unread?: boolean;
  cursor?: string;
}
