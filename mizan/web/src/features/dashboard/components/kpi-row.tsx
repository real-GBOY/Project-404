import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoneyList, formatNumber } from "@/lib/format";
import type { DashboardKpis } from "../types/dashboard";

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useTranslation("dashboard");

  const outstanding = kpis.outstanding.length
    ? formatMoneyList(kpis.outstanding)
    : ["—"];
  const collected = kpis.collectedThisMonth.length
    ? formatMoneyList(kpis.collectedThisMonth)
    : ["—"];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard label={t("kpi.active_matters")} value={formatNumber(kpis.activeMatters)} icon="gavel" />
      <StatCard label={t("kpi.open_tasks")} value={formatNumber(kpis.openTasks)} icon="task_alt" />
      <StatCard
        label={t("kpi.hearings_week")}
        value={formatNumber(kpis.hearingsThisWeek)}
        icon="event"
      />
      <StatCard label={t("kpi.outstanding")} value={outstanding} icon="request_quote" />
      <StatCard label={t("kpi.collected_month")} value={collected} icon="payments" />
    </div>
  );
}
