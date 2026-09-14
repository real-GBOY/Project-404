import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
  push: (item: Omit<NotificationItem, "id" | "read">) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  initial,
  children,
}: {
  initial: NotificationItem[];
  children: ReactNode;
}) {
  const [items, setItems] = useState<NotificationItem[]>(initial);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unreadCount: items.filter((n) => !n.read).length,
      markAllRead: () => setItems((prev) => prev.map((n) => ({ ...n, read: true }))),
      markRead: (id) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
      push: (item) =>
        setItems((prev) => [{ ...item, id: `n_${Date.now()}`, read: false }, ...prev]),
    }),
    [items],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationsProvider>");
  return ctx;
}
