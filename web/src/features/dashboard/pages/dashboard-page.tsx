import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
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
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-52" />
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const query = useDashboard();
  const firstName = user?.displayName?.split(" ")[0] ?? "";

  return (
    <PageContainer>
      <PageHeader
        title={firstName ? t("greeting", { name: firstName }) : t("title")}
        description={t("subtitle")}
      />

      <QueryBoundary query={query} loading={<DashboardSkeleton />}>
        {(data) => (
          <div className="flex flex-col gap-6">
            <KpiRow kpis={data.kpis} />

            <div className="grid gap-4 lg:grid-cols-2">
              <UpcomingHearingsPanel hearings={data.upcomingHearings} />
              <UrgentDeadlinesPanel deadlines={data.urgentDeadlines} />
              <MyTasksPanel tasks={data.myTasks} />
              <ReviewDocumentsPanel documents={data.reviewDocuments} />
              <PracticeAreaChart data={data.practiceAreas} />
              <BillingChart data={data.billingSeries} />
            </div>

            <RecentActivityPanel activity={data.recentActivity} />
          </div>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}
