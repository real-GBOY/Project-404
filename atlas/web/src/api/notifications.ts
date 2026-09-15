import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ENDPOINTS } from "@/config";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  href?: string;
}

interface NotificationsResponse {
  items: NotificationRow[];
  unreadCount: number;
}

export function useNotificationsList(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => get<NotificationsResponse>(ENDPOINTS.notifications.list),
    refetchInterval: 30_000,
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<void>(ENDPOINTS.notifications.read(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<void>(ENDPOINTS.notifications.readAll),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
