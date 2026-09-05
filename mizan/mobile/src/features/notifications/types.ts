import type { Paginated } from "@/types/api";

/** Ported from mizan/web/src/features/notifications/types/notification.ts. */
export interface AppNotification {
  id: string;
  /** dotted event key, e.g. `hearing.scheduled` */
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  href?: string;
  data?: Record<string, unknown>;
}

export type NotificationList = Paginated<AppNotification> & { unreadCount?: number };

export interface NotificationListParams {
  unread?: boolean;
  cursor?: string;
}
