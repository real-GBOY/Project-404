import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoneyList, formatNumber } from "@/lib/format";
import type { DashboardKpis } from "../types/dashboard";

/** The prototype's four dashboard KPI tiles — icon row, 28px value, tone sub-line. */
export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useTranslation("dashboard");

  const unbilled = kpis.unbilledValue.length ? formatMoneyList(kpis.unbilledValue).join(" · ") : "—";
  const overdueAmount = kpis.overdueAmount.length
    ? formatMoneyList(kpis.overdueAmount).join(" · ")
    : "—";
  const outstanding = kpis.outstanding.length ? formatMoneyList(kpis.outstanding) : ["—"];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon="gavel"
        size="lg"
        label={t("kpi.active_matters")}
        value={formatNumber(kpis.activeMatters)}
        sub={t("kpi.active_matters_sub", {
          opened: kpis.openedThisMonth,
          closed: kpis.closedYtd,
        })}
        subTone="success"
      />
      <StatCard
        icon="balance"
        size="lg"
        label={t("kpi.hearings_month")}
        value={formatNumber(kpis.hearingsThisMonth)}
        sub={t("kpi.hearings_month_sub", {
          next7: kpis.hearingsNext7,
          adjourned: kpis.adjournedThisMonth,
        })}
        subTone="muted"
      />
      <StatCard
        icon="schedule"
        size="lg"
        label={t("kpi.unbilled")}
        value={formatNumber(kpis.unbilledHours)}
        unit={t("kpi.hrs")}
        sub={t("kpi.unbilled_sub", { value: unbilled })}
        subTone="warning"
      />
      <StatCard
        icon="receipt_long"
        size="lg"
        label={t("kpi.outstanding")}
        value={outstanding}
        sub={t("kpi.outstanding_sub", { count: kpis.overdueInvoices, amount: overdueAmount })}
        subTone="danger"
      />
    </div>
  );
}
