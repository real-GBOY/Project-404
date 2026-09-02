import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useUrlParams } from "@/hooks/use-url-params";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications.api";
import { notificationKeys } from "../api/notifications.keys";
import type { AppNotification } from "../types/notification";

const ICON: Record<string, string> = {
  "hearing.scheduled": "event",
  "hearing.adjourned": "event_repeat",
  "task.assigned": "task_alt",
  "invoice.paid": "payments",
  "matter.update_added": "gavel",
};

export function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useUrlParams<"filter">({ filter: "all" });
  const unreadOnly = params.get("filter") === "unread";

  const query = useQuery({
    queryKey: notificationKeys.list({ unread: unreadOnly }),
    queryFn: ({ signal }) => listNotifications({ unread: unreadOnly }, signal),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: notificationKeys.all });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            variant="secondary"
            icon="done_all"
            onClick={() => readAll.mutate()}
            loading={readAll.isPending}
          >
            {t("mark_all_read")}
          </Button>
        }
      />

      <SegmentedControl
        aria-label={t("filter.label")}
        value={unreadOnly ? "unread" : "all"}
        onValueChange={(v) => params.set({ filter: v === "all" ? undefined : v })}
        options={[
          { value: "all", label: t("filter.all") },
          { value: "unread", label: t("filter.unread") },
        ]}
      />

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="notifications" title={t("empty.title")} description={t("empty.body")} />}
      >
        {(data) => (
          <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
            {data.items.map((n: AppNotification) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.readAt) readOne.mutate(n.id);
                  if (n.href) navigate(n.href);
                }}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-surface-subtle",
                  !n.readAt && "bg-surface-warm",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 flex-none items-center justify-center rounded-md",
                    n.readAt ? "bg-surface-subtle text-muted" : "bg-surface-sand text-link",
                  )}
                >
                  <Icon name={ICON[n.type] ?? "notifications"} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[12.5px]", n.readAt ? "font-medium text-foreground-body" : "font-bold text-foreground")}>
                    {n.title}
                  </div>
                  {n.body && <div className="text-[11.5px] text-muted">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-subtle">{formatRelative(n.createdAt)}</div>
                </div>
                {!n.readAt && <span className="mt-1.5 size-2 flex-none rounded-full bg-danger" />}
              </button>
            ))}
          </div>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}
