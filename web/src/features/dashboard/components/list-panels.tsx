import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatRelative } from "@/lib/format";
import { DashboardPanel, PanelEmpty } from "./dashboard-panel";
import type {
  ActivityEntry,
  DashboardDeadline,
  DashboardDocument,
  DashboardHearing,
  DashboardTask,
} from "../types/dashboard";

const rowLink =
  "flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-subtle";

function dueTone(dueAt: string | null): string {
  if (!dueAt) return "text-muted";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return "text-danger";
  if (diff < 2 * 86_400_000) return "text-warning";
  return "text-muted";
}

export function UpcomingHearingsPanel({ hearings }: { hearings: DashboardHearing[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardPanel
      title={t("panels.upcoming_hearings")}
      icon="event"
      viewAllTo="/calendar"
      count={hearings.length}
    >
      {hearings.length === 0 ? (
        <PanelEmpty label={t("panels.no_hearings")} />
      ) : (
        <ul className="flex flex-col">
          {hearings.map((h) => (
            <li key={h.id}>
              <Link to={`/matters/${h.matterId}`} className={rowLink}>
                <div className="flex w-11 flex-none flex-col items-center rounded-md bg-surface-sand py-1 text-link">
                  <span className="text-[15px] font-extrabold leading-none">
                    {formatDate(h.scheduledAt, { day: "2-digit" })}
                  </span>
                  <span className="text-[9.5px] font-bold uppercase">
                    {formatDate(h.scheduledAt, { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">
                    {h.matterTitle}
                  </p>
                  <p className="truncate text-[11.5px] text-muted">
                    {h.court} · {formatDate(h.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

export function UrgentDeadlinesPanel({ deadlines }: { deadlines: DashboardDeadline[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardPanel
      title={t("panels.urgent_deadlines")}
      icon="priority_high"
      count={deadlines.length}
    >
      {deadlines.length === 0 ? (
        <PanelEmpty label={t("panels.no_deadlines")} />
      ) : (
        <ul className="flex flex-col">
          {deadlines.map((d) => (
            <li key={d.id}>
              <Link to={d.matterId ? `/matters/${d.matterId}` : "/calendar"} className={rowLink}>
                <Icon name="flag" size={16} className={cn("mt-0.5 flex-none", dueTone(d.dueAt))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{d.title}</p>
                  <p className="truncate text-[11.5px] text-muted">
                    {d.matterTitle} · <span className={dueTone(d.dueAt)}>{formatRelative(d.dueAt)}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

export function MyTasksPanel({ tasks }: { tasks: DashboardTask[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardPanel title={t("panels.my_tasks")} icon="check_circle" viewAllTo="/matters?tab=tasks" count={tasks.length}>
      {tasks.length === 0 ? (
        <PanelEmpty label={t("panels.no_tasks")} />
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 px-2 py-2">
              <Icon
                name={task.priority === "high" ? "arrow_upward" : "radio_button_unchecked"}
                size={15}
                className={cn("mt-0.5 flex-none", task.priority === "high" ? "text-danger" : "text-subtle")}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">{task.title}</p>
                <p className="truncate text-[11.5px] text-muted">
                  {task.matterTitle ?? t("panels.no_matter")}
                  {task.dueAt && (
                    <>
                      {" · "}
                      <span className={dueTone(task.dueAt)}>{formatRelative(task.dueAt)}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

export function ReviewDocumentsPanel({ documents }: { documents: DashboardDocument[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardPanel
      title={t("panels.review_documents")}
      icon="draft"
      viewAllTo="/documents"
      count={documents.length}
    >
      {documents.length === 0 ? (
        <PanelEmpty label={t("panels.no_documents")} />
      ) : (
        <ul className="flex flex-col">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-start gap-3 px-2 py-2">
              <Icon name="description" size={16} className="mt-0.5 flex-none text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">{doc.name}</p>
                <p className="truncate text-[11.5px] text-muted">
                  {doc.matterTitle} · {formatRelative(doc.uploadedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

export function RecentActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <DashboardPanel title={t("panels.recent_activity")} icon="history">
      {activity.length === 0 ? (
        <PanelEmpty label={t("panels.no_activity")} />
      ) : (
        <ul className="flex flex-col">
          {activity.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-2 py-2">
              <Avatar name={entry.actor} size="xs" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-foreground-body">
                  <span className="font-semibold text-foreground">{entry.actor}</span>{" "}
                  {t(`activity.${entry.action}`, { defaultValue: entry.action.replace(/[._]/g, " ") })}{" "}
                  <span className="font-medium">{entry.target}</span>
                </p>
                <p className="text-[11px] text-muted">{formatRelative(entry.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
