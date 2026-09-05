import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/use-auth";
import { listNotifications, markNotificationRead, markAllNotificationsRead, notificationKeys } from "./api";
import type { NotificationListParams } from "./types";

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: ({ signal }) => listNotifications(params, signal),
  });
}

/** Unread badge count for the Today header's bell — degrades to 0 on error
 *  rather than showing a broken badge. Ported from web's
 *  `useUnreadNotificationsCount`. */
export function useUnreadNotificationsCount(): number {
  const { status } = useAuth();
  const query = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async ({ signal }) => {
      const page = await listNotifications({ unread: true }, signal);
      return page.unreadCount ?? page.items.length;
    },
    enabled: status === "authed",
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  return query.data ?? 0;
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: notificationKeys.all });
  return {
    markRead: useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate }),
    markAllRead: useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate }),
  };
}
