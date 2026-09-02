import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { PanelHeader, PanelLink } from "@/components/tables/list-card";
import { formatDate, formatMoney, formatMoneyList } from "@/lib/format";
import type { DashboardBilling } from "../types/dashboard";

/**
 * Billed vs collected over recent months — the prototype's grouped bars
 * (espresso "billed", tan "collected"), one scale, with a YTD stat row and the
 * collection-rate pill.
 */
export function BillingChart({ billing }: { billing: DashboardBilling }) {
  const { t } = useTranslation("dashboard");
  const [active, setActive] = useState<number | null>(null);

  const { series } = billing;
  const currency = series[0]?.currency ?? "EGP";
  const max = Math.max(1, ...series.map((d) => Math.max(d.billed, d.collected)));

  const billed = formatMoneyList(billing.billedYtd)[0] ?? "—";
  const collected = formatMoneyList(billing.collectedYtd)[0] ?? "—";

  return (
    <Card>
      <PanelHeader
        icon="query_stats"
        title={t("panels.billing_vs_collections")}
        action={<PanelLink to="/billing">{t("panels.open_finance")}</PanelLink>}
      />
      <div className="p-[18px]">
        <div className="mb-3.5 flex items-end gap-[18px]">
          <div>
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-foreground">
              {billed}
            </div>
            <div className="text-[11px] font-semibold text-muted">{t("panels.billed_ytd")}</div>
          </div>
          <div>
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-muted">
              {collected}
            </div>
            <div className="text-[11px] font-semibold text-muted">{t("panels.collected_ytd")}</div>
          </div>
          <span className="ms-auto rounded-pill bg-success-surface px-2.5 py-1 text-[11.5px] font-bold text-success">
            {t("panels.collection_rate", { rate: billing.collectionRate })}
          </span>
        </div>

        <div className="flex h-[150px] items-end gap-3.5 border-t border-dashed border-border-input pt-3.5">
          {series.map((point, i) => {
            const label = formatDate(`${point.month}-01`, { month: "long", year: "numeric" });
            return (
              <div
                key={point.month}
                role="img"
                aria-label={`${label} — ${t("panels.billed")} ${formatMoney({ currency, amount: String(point.billed) })}, ${t("panels.collected")} ${formatMoney({ currency, amount: String(point.collected) })}`}
                className="relative flex flex-1 flex-col items-center gap-[7px]"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {active === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md bg-primary-deep px-2 py-1.5 text-[11px] text-primary-foreground shadow-menu">
                    <div className="font-bold">{label}</div>
                    <div>
                      {t("panels.billed")}:{" "}
                      {formatMoney({ currency, amount: String(point.billed) })}
                    </div>
                    <div>
                      {t("panels.collected")}:{" "}
                      {formatMoney({ currency, amount: String(point.collected) })}
                    </div>
                  </div>
                )}
                <div className="flex h-[112px] items-end gap-1">
                  <div
                    className="w-[14px] rounded-t-[5px] bg-primary"
                    style={{ height: `${(point.billed / max) * 100}%` }}
                  />
                  <div
                    className="w-[14px] rounded-t-[5px] bg-chart-soft"
                    style={{ height: `${(point.collected / max) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted">
                  {formatDate(`${point.month}-01`, { month: "short" })}
                </span>
              </div>
            );
          })}
          <div className="flex flex-none flex-col justify-center gap-1.5 self-stretch border-s border-divider ps-2.5">
            <span className="flex items-center gap-[7px] text-[11px] font-semibold text-secondary">
              <span className="size-[9px] rounded-[3px] bg-primary" /> {t("panels.billed")}
            </span>
            <span className="flex items-center gap-[7px] text-[11px] font-semibold text-secondary">
              <span className="size-[9px] rounded-[3px] bg-chart-soft" /> {t("panels.collected")}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
