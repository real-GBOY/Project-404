import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/use-auth";
import { listNotifications } from "../api/notifications.api";
import { notificationKeys } from "../api/notifications.keys";

/**
 * Unread badge count for the top bar. Polls quietly; degrades to `0` on error
 * (no backend in local dev) so the shell never shows a broken bell.
 */
export function useUnreadNotificationsCount(): number {
  const { status } = useAuth();

  const query = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async ({ signal }) => {
      const page = await listNotifications({ unread: true }, signal);
      return page.unreadCount ?? page.items.filter((n) => !n.readAt).length;
    },
    enabled: status === "authed",
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });

  return query.data ?? 0;
}
