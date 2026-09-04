import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { formatDate } from "@/lib/format";
import { downloadCsv, exportStamp } from "@/lib/export";
import type { DashboardData } from "../types/dashboard";
import { useDashboard } from "../hooks/use-dashboard";
import { KpiRow } from "../components/kpi-row";
import { PracticeAreaChart } from "../components/practice-area-chart";
import { BillingChart } from "../components/billing-chart";
import {
  MyTasksPanel,
  RecentActivityPanel,
  ReviewDocumentsPanel,
  UpcomingHearingsPanel,
  UrgentDeadlinesPanel,
} from "../components/list-panels";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}

function greet(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Flatten the dashboard's action lists into one printable briefing CSV. */
function exportBriefing(data: DashboardData) {
  const rows = [
    ...data.upcomingHearings.map((h) => ({
      section: "Hearing",
      item: h.matterTitle,
      reference: h.matterNumber,
      detail: h.court,
      owner: h.leadLawyer,
      due: h.scheduledAt,
    })),
    ...data.urgentDeadlines.map((d) => ({
      section: "Deadline",
      item: d.title,
      reference: d.matterNumber,
      detail: d.matterTitle,
      owner: d.owner,
      due: d.dueAt,
    })),
    ...data.myTasks.map((tk) => ({
      section: "Task",
      item: tk.title,
      reference: "",
      detail: tk.matterTitle ?? "",
      owner: tk.assignee,
      due: tk.dueAt ?? "",
    })),
  ];
  downloadCsv(
    `mizan-briefing-${exportStamp()}`,
    [
      { key: "section", header: "Section" },
      { key: "item", header: "Item" },
      { key: "reference", header: "Matter" },
      { key: "detail", header: "Detail" },
      { key: "owner", header: "Owner" },
      { key: "due", header: "Due" },
    ],
    rows,
  );
}

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const query = useDashboard();
  const firstName = user?.displayName?.split(" ")[0] ?? "";

  return (
    <PageContainer className="gap-[18px]">
      <QueryBoundary query={query} loading={<DashboardSkeleton />}>
        {(data) => {
          const near = data.kpis.hearingsNext7 + data.urgentDeadlines.length;
          return (
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-[28px] font-normal leading-[1.1] tracking-[0.01em] text-foreground">
                    {firstName
                      ? t(`greeting.${greet(new Date().getHours())}`, { name: firstName })
                      : t("title")}
                  </h1>
                  <p className="mt-1 text-[13.5px] font-medium text-muted-2">
                    {formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
                    {near > 0 && (
                      <>
                        {" · "}
                        {t("greeting.summary", {
                          hearings: data.kpis.hearingsNext7,
                          deadlines: data.urgentDeadlines.length,
                        })}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-[9px]">
                  <Button size="sm" icon="download" onClick={() => exportBriefing(data)}>
                    {t("export")}
                  </Button>
                </div>
              </div>

              {data.alert && (
                <div className="flex flex-wrap items-center gap-3 rounded-card border border-border-warm bg-surface-warm px-4 py-[13px]">
                  <Icon name="error" size={20} className="text-primary" />
                  <div className="text-[13px] font-bold text-foreground">
                    {t(`alert.${data.alert.title}`, {
                      count: data.urgentDeadlines.filter((d) => d.severity === "critical").length,
                    })}
                  </div>
                  <div className="min-w-0 flex-1 text-[13px] font-medium text-muted-2">
                    {data.alert.detail}
                  </div>
                  <Link
                    to="/matters"
                    className="whitespace-nowrap text-[12.5px] font-bold text-link"
                  >
                    {t("alert.view_deadlines")} →
                  </Link>
                </div>
              )}

              <KpiRow kpis={data.kpis} />

              <div className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr]">
                <UpcomingHearingsPanel hearings={data.upcomingHearings} />
                <UrgentDeadlinesPanel deadlines={data.urgentDeadlines} />
              </div>

              <div className="grid gap-3.5 lg:grid-cols-[1fr_1.3fr]">
                <PracticeAreaChart data={data.practiceAreas} />
                <BillingChart billing={data.billing} />
              </div>

              <div className="grid items-start gap-3.5 lg:grid-cols-[1.4fr_1fr]">
                <MyTasksPanel tasks={data.myTasks} />
                <div className="flex flex-col gap-3.5">
                  <ReviewDocumentsPanel documents={data.reviewDocuments} />
                  <RecentActivityPanel activity={data.recentActivity} />
                </div>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageContainer>
  );
}
