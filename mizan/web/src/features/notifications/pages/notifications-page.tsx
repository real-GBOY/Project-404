import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatRelative } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PanelHeader } from "@/components/tables/list-card";
import { ListCard } from "@/components/tables/list-card";
import { useUrlParams } from "@/hooks/use-url-params";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications.api";
import { notificationKeys } from "../api/notifications.keys";
import type { AppNotification } from "../types/notification";

const ICON: Record<string, string> = {
  "hearing.scheduled": "gavel",
  "hearing.adjourned": "gavel",
  "task.assigned": "task_alt",
  "invoice.paid": "payments",
  "invoice.overdue": "schedule",
  "payment.received": "payments",
  "matter.update_added": "gavel",
  "document.uploaded": "description",
  "deadline.approaching": "warning",
};

const PREF_KEYS = [
  ["hearing_reminders", true],
  ["filing_deadlines", true],
  ["document_uploads", true],
  ["payments", false],
  ["digest", true],
] as const;

function Preferences() {
  const { t } = useTranslation("notifications");
  return (
    <Card>
      <CardBody className="p-[18px]">
        <div className="mb-3.5 text-[14px] font-extrabold text-foreground">
          {t("preferences.title")}
        </div>
        <div className="flex flex-col gap-3.5">
          {PREF_KEYS.map(([key, on]) => (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[12.5px] font-bold text-foreground">
                  {t(`preferences.${key}`)}
                </div>
                <div className="text-[11px] font-medium text-muted">
                  {t(`preferences.${key}_d`)}
                </div>
              </div>
              <Switch defaultChecked={on} aria-label={t(`preferences.${key}`)} />
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

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
  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.list({ unread: true }),
    queryFn: ({ signal }) => listNotifications({ unread: true }, signal),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: notificationKeys.all });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
  const unread = unreadCountQuery.data?.items.length ?? 0;

  return (
    <PageContainer>
      <div className="grid items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <ListCard>
          <PanelHeader
            title={t("all_notifications")}
            action={
              <div className="flex items-center gap-2.5">
                {unread > 0 && (
                  <span className="rounded-pill bg-surface-sand px-[9px] py-[3px] text-[11px] font-bold text-link">
                    {t("n_unread", { count: unread })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => readAll.mutate()}
                  className="text-[12px] font-bold text-link hover:underline"
                >
                  {t("mark_all_read")}
                </button>
              </div>
            }
          />

          <div className="border-b border-divider px-[18px] py-2.5">
            <SegmentedControl
              aria-label={t("filter.label")}
              size="sm"
              value={unreadOnly ? "unread" : "all"}
              onValueChange={(v) => params.set({ filter: v === "all" ? undefined : v })}
              options={[
                { value: "all", label: t("filter.all") },
                { value: "unread", label: t("filter.unread") },
              ]}
            />
          </div>

          <QueryBoundary
            query={query}
            loading={<RowsSkeleton rows={6} />}
            isEmpty={(d) => d.items.length === 0}
            empty={
              <EmptyState
                icon="notifications"
                title={t("empty.title")}
                description={t("empty.body")}
              />
            }
          >
            {(data) =>
              data.items.map((n: AppNotification) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.readAt) readOne.mutate(n.id);
                    if (n.href) navigate(n.href);
                  }}
                  className="flex w-full items-start gap-3 border-b border-divider-row px-[18px] py-3.5 text-start last:border-0 hover:bg-surface-subtle"
                >
                  <span className="grid size-[34px] flex-none place-items-center rounded-btn bg-surface-warm-2 text-link">
                    <Icon name={ICON[n.type] ?? "notifications"} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-extrabold text-foreground">{n.title}</span>
                      {!n.readAt && (
                        <span className="size-[7px] flex-none rounded-full bg-primary" />
                      )}
                    </div>
                    {n.body && (
                      <div className="mt-[3px] text-[12.5px] font-medium leading-[1.55] text-secondary">
                        {n.body}
                      </div>
                    )}
                    <div className="mt-1.5 text-[11px] font-semibold text-subtle">
                      {formatRelative(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            }
          </QueryBoundary>
        </ListCard>

        <Preferences />
      </div>
    </PageContainer>
  );
}
