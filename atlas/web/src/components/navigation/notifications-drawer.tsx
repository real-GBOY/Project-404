import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerSection } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  useNotifications,
  type NotificationCategory,
} from "@/lib/notifications/notifications-provider";

const TABS: (NotificationCategory | "All")[] = ["All", "Approvals", "Sales", "Payments", "Leads", "AI"];

const ICON_TONE: Record<NotificationCategory, string> = {
  Payments: "bg-danger-surface text-danger",
  AI: "bg-primary-surface text-primary",
  Approvals: "bg-success-surface text-success",
  Sales: "bg-info-surface text-info",
  Leads: "bg-info-surface text-info",
  General: "bg-surface-track text-muted",
};

export function NotificationsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { items, markAllRead, markRead } = useNotifications();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const filtered = tab === "All" ? items : items.filter((n) => n.category === tab);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Notifications" width={380}>
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
        {TABS.map((t) => (
          <Chip key={t} active={tab === t} activeVariant="pale" onClick={() => setTab(t)}>
            {t}
          </Chip>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={markAllRead}
          className="whitespace-nowrap text-[10.5px] font-semibold text-primary hover:underline"
        >
          Mark all read
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="bell"
          title="You're all caught up"
          description="New leads, payment events, and approval requests will show up here as they happen."
        />
      ) : (
        filtered.map((n) => (
          <DrawerSection key={n.id} className={n.read ? undefined : "bg-surface-unread"}>
            <div
              className="flex gap-2.5"
              role="button"
              tabIndex={0}
              onClick={() => markRead(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  markRead(n.id);
                }
              }}
            >
              <span className={`flex size-[26px] flex-none items-center justify-center rounded-sm ${ICON_TONE[n.category]}`}>
                <Icon name={n.icon} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-foreground">{n.title}</span>
                  <span className="flex-none text-[9.5px] text-subtle">{n.when}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-secondary">{n.body}</p>
                {n.action && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChange(false);
                      navigate(n.action!.to);
                    }}
                  >
                    {n.action.label}
                  </Button>
                )}
              </div>
            </div>
          </DrawerSection>
        ))
      )}
    </Drawer>
  );
}
