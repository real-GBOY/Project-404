import { createContext, useContext, useMemo, type ReactNode } from "react";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/features/auth/auth-provider";
import { useNotificationsList, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/api/notifications";

export type NotificationCategory = "Payments" | "AI" | "Approvals" | "Sales" | "Leads" | "General";

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  icon: string;
  title: string;
  body: string;
  when: string;
  read: boolean;
  action?: { label: string; to: string };
}

interface NotificationsContextValue {
  items: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const TYPE_CATEGORY: Record<string, NotificationCategory> = {
  payment: "Payments",
  ai_insight: "AI",
  approval: "Approvals",
  reservation: "Sales",
  contract: "Sales",
  lead: "Leads",
  followup: "Leads",
};

const TYPE_ICON: Record<NotificationCategory, string> = {
  Payments: "payment",
  AI: "spark",
  Approvals: "approval",
  Sales: "deal",
  Leads: "lead",
  General: "bell",
};

function categoryOf(type: string): NotificationCategory {
  for (const [prefix, category] of Object.entries(TYPE_CATEGORY)) if (type.startsWith(prefix)) return category;
  return "General";
}

/** Backed by the real `/api/realestate/notifications` inbox. Currently no domain service in this
 *  build emits notifications yet (no `INotificationProvider` call sites in the realestate modules),
 *  so this is honestly usually empty rather than showing fabricated activity. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { data } = useNotificationsList(auth.status === "authenticated");
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const value = useMemo<NotificationsContextValue>(() => {
    const items: NotificationItem[] = (data?.items ?? []).map((n) => {
      const category = categoryOf(n.type);
      return {
        id: n.id,
        category,
        icon: TYPE_ICON[category],
        title: n.title,
        body: n.body,
        when: timeAgo(n.createdAt),
        read: n.readAt !== null,
        action: n.href ? { label: "Open", to: n.href } : undefined,
      };
    });
    return {
      items,
      unreadCount: data?.unreadCount ?? 0,
      markAllRead: () => markAllRead.mutate(),
      markRead: (id: string) => markRead.mutate(id),
    };
  }, [data, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationsProvider>");
  return ctx;
}
