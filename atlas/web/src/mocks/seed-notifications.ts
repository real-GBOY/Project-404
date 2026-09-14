import type { NotificationItem } from "@/lib/notifications/notifications-provider";
import { NOTIFICATIONS } from "@/mocks/fixtures/notifications";

/**
 * Adapter seed for `<NotificationsProvider>` — reconciles the extracted
 * fixture's column names (`age`/`actionLabel`/`targetRoute`/`unread`) with
 * the shape the app's UI actually consumes (`when`/`action`/`read`).
 */
export const NOTIFICATIONS_SEED: NotificationItem[] = NOTIFICATIONS.map((n, i) => ({
  id: `n${i + 1}`,
  category: n.category,
  icon: n.icon,
  title: n.title,
  body: n.body,
  when: n.age,
  read: !n.unread,
  action: n.actionLabel ? { label: n.actionLabel, to: `/${n.targetRoute}` } : undefined,
}));
