import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  ColumnHeader,
  ListCard,
  ListRow,
  PanelHeader,
  PanelLink,
} from "@/components/tables/list-card";
import { formatDate, formatRelative } from "@/lib/format";
import type {
  ActivityEntry,
  DashboardDeadline,
  DashboardDocument,
  DashboardHearing,
  DashboardTask,
} from "../types/dashboard";

const HEARING_TONE: Record<DashboardHearing["status"], PillTone> = {
  confirmed: "green",
  awaiting_court: "amber",
  adjourned: "gray",
};

export function UpcomingHearingsPanel({ hearings }: { hearings: DashboardHearing[] }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();

  return (
    <ListCard>
      <PanelHeader
        icon="event"
        title={t("panels.upcoming_hearings")}
        action={<PanelLink to="/matters">{t("panels.see_all")}</PanelLink>}
      />
      {hearings.length === 0 ? (
        <p className="px-[18px] py-8 text-center text-[12.5px] text-muted">
          {t("panels.no_hearings")}
        </p>
      ) : (
        hearings.map((h) => (
          <ListRow key={h.id} className="gap-3.5" onClick={() => navigate(`/matters/${h.matterId}`)}>
            <div className="w-[46px] flex-none rounded-btn bg-surface-sand py-1.5 text-center">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-link">
                {formatDate(h.scheduledAt, { month: "short" })}
              </div>
              <div className="text-[16px] font-extrabold leading-[1.1] text-primary-deepest">
                {formatDate(h.scheduledAt, { day: "numeric" })}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-foreground">{h.matterTitle}</div>
              <div className="mt-0.5 truncate text-[11.5px] font-medium text-muted">
                {h.court} · {h.matterNumber}
              </div>
            </div>
            <div className="flex-none text-end">
              <div className="text-[13px] font-extrabold text-foreground">
                {formatDate(h.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-[11px] font-semibold text-muted">{h.leadLawyer}</div>
            </div>
            <Pill tone={HEARING_TONE[h.status]}>{t(`hearing_status.${h.status}`)}</Pill>
          </ListRow>
        ))
      )}
    </ListCard>
  );
}

export function UrgentDeadlinesPanel({ deadlines }: { deadlines: DashboardDeadline[] }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const criticalCount = deadlines.filter((d) => d.severity === "critical").length;

  return (
    <ListCard>
      <PanelHeader
        icon="alarm"
        iconClassName="text-danger-solid"
        title={t("panels.urgent_deadlines")}
        action={
          criticalCount > 0 && (
            <span className="rounded-pill bg-danger-surface px-[9px] py-[3px] text-[11px] font-bold text-danger">
              {t("panels.n_critical", { count: criticalCount })}
            </span>
          )
        }
      />
      {deadlines.length === 0 ? (
        <p className="px-[18px] py-8 text-center text-[12.5px] text-muted">
          {t("panels.no_deadlines")}
        </p>
      ) : (
        deadlines.map((d) => (
          <ListRow
            key={d.id}
            onClick={d.matterId ? () => navigate(`/matters/${d.matterId}`) : undefined}
          >
            <span
              className={cn(
                "w-[3px] flex-none self-stretch rounded-full",
                d.severity === "critical" ? "bg-priority-critical" : "bg-priority-warning",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground">{d.title}</div>
              <div className="mt-0.5 truncate text-[11.5px] font-medium text-muted">
                {d.matterNumber} · {d.owner}
              </div>
            </div>
            <div className="flex-none text-end">
              <div className="text-[12px] font-bold text-foreground">
                {formatDate(d.dueAt, { day: "numeric", month: "short" })}
              </div>
              <Pill tone={d.severity === "critical" ? "red" : "amber"}>
                {formatRelative(d.dueAt)}
              </Pill>
            </div>
          </ListRow>
        ))
      )}
    </ListCard>
  );
}

const PRIORITY_TONE: Record<DashboardTask["priority"], PillTone> = {
  high: "red",
  normal: "amber",
  low: "gray",
};
type TaskScope = "today" | "week" | "overdue" | "all";

export function MyTasksPanel({ tasks }: { tasks: DashboardTask[] }) {
  const { t } = useTranslation("dashboard");
  const [scope, setScope] = useState<TaskScope>("today");

  const filtered = useMemo(() => {
    const now = Date.now();
    return tasks.filter((task) => {
      if (scope === "all") return true;
      if (!task.dueAt) return scope === "overdue" ? false : true;
      const diff = new Date(task.dueAt).getTime() - now;
      if (scope === "overdue") return diff < 0;
      if (scope === "today") return diff < 86_400_000;
      return diff < 7 * 86_400_000;
    });
  }, [tasks, scope]);

  return (
    <ListCard>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-divider px-[18px] py-3.5">
        <span className="text-[14px] font-extrabold text-foreground">{t("panels.my_tasks")}</span>
        <SegmentedControl
          aria-label={t("panels.my_tasks")}
          size="sm"
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "today", label: t("task_scope.today") },
            { value: "week", label: t("task_scope.week") },
            { value: "overdue", label: t("task_scope.overdue") },
            { value: "all", label: t("task_scope.all") },
          ]}
        />
        <span className="ms-auto">
          <PanelLink to="/matters">{t("panels.open_tasks")}</PanelLink>
        </span>
      </div>
      <ColumnHeader
        columns={[
          { key: "task", label: t("cols.task"), flex: 1 },
          { key: "assignee", label: t("cols.assignee"), width: 120 },
          { key: "due", label: t("cols.due"), width: 100 },
          { key: "priority", label: t("cols.priority"), width: 90 },
        ]}
      />
      {filtered.length === 0 ? (
        <p className="px-[18px] py-8 text-center text-[12.5px] text-muted">{t("panels.no_tasks")}</p>
      ) : (
        filtered.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 border-b border-divider-row px-[18px] py-3 last:border-0 hover:bg-surface-subtle"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className="size-[17px] flex-none rounded-xs border-[1.6px] border-checkbox"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-foreground">{task.title}</div>
                <div className="text-[11px] font-semibold text-muted">
                  {task.matterTitle ?? t("panels.no_matter")}
                </div>
              </div>
            </div>
            <span className="w-[120px] flex-none text-[12px] font-semibold text-secondary">
              {task.assignee}
            </span>
            <span className="w-[100px] flex-none text-[12px] font-semibold text-secondary">
              {task.dueAt ? formatDate(task.dueAt, { day: "numeric", month: "short" }) : "—"}
            </span>
            <span className="w-[90px] flex-none">
              <Pill tone={PRIORITY_TONE[task.priority]}>{t(`priority.${task.priority}`)}</Pill>
            </span>
          </div>
        ))
      )}
    </ListCard>
  );
}

const DOC_TONE: Record<DashboardDocument["status"], PillTone> = {
  awaiting_review: "amber",
  expiring: "red",
  in_review: "blue",
};

export function ReviewDocumentsPanel({ documents }: { documents: DashboardDocument[] }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();

  return (
    <ListCard>
      <PanelHeader
        icon="rate_review"
        iconClassName="text-warning"
        title={t("panels.review_documents")}
        action={<PanelLink to="/documents">{t("panels.all")}</PanelLink>}
      />
      {documents.length === 0 ? (
        <p className="px-[18px] py-8 text-center text-[12.5px] text-muted">
          {t("panels.no_documents")}
        </p>
      ) : (
        documents.map((doc) => (
          <ListRow key={doc.id} className="gap-[11px]" onClick={() => navigate("/documents")}>
            <Icon name="description" size={20} className="flex-none text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-bold text-foreground">{doc.name}</div>
              <div className="text-[11px] font-semibold text-muted">
                {doc.matterTitle} · {formatRelative(doc.uploadedAt)}
              </div>
            </div>
            <Pill tone={DOC_TONE[doc.status]}>{t(`doc_status.${doc.status}`)}</Pill>
          </ListRow>
        ))
      )}
    </ListCard>
  );
}

export function RecentActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  const { t } = useTranslation("dashboard");

  return (
    <ListCard>
      <PanelHeader icon="history" title={t("panels.recent_activity")} />
      <div className="flex flex-col gap-[15px] px-[18px] py-4">
        {activity.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-muted">{t("panels.no_activity")}</p>
        ) : (
          activity.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <span className="grid size-[30px] flex-none place-items-center rounded-control bg-surface-warm-2 text-link">
                <Icon name={entry.icon} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold leading-[1.4] text-foreground">
                  {t(`activity.${entry.action}`, {
                    defaultValue: entry.action.replace(/[._]/g, " "),
                  })}
                  {" — "}
                  <span className="font-semibold text-foreground-body">{entry.target}</span>
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-muted">
                  {entry.actor} · {formatRelative(entry.at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ListCard>
  );
}
