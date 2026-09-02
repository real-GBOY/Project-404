import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate, formatMoney } from "@/lib/format";
import { DashboardPanel } from "./dashboard-panel";
import type { BillingPoint } from "../types/dashboard";

/**
 * Billed vs collected over 6 months. Collected is always ≤ billed, so it's drawn
 * as a darker fill *inside* the billed bar (one hue, light→dark) rather than a
 * two-colour grouped chart — the gap reads as the collection shortfall.
 */
export function BillingChart({ data }: { data: BillingPoint[] }) {
  const { t } = useTranslation("dashboard");
  const [active, setActive] = useState<number | null>(null);
  const currency = data[0]?.currency ?? "EGP";
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.billed)), [data]);

  return (
    <DashboardPanel title={t("panels.billing_vs_collections", { currency })} icon="bar_chart">
      <div className="p-2">
        <div className="mb-3 flex items-center gap-4 text-[11px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-chart-track" /> {t("panels.billed")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-chart-fill" /> {t("panels.collected")}
          </span>
        </div>

        <div className="flex h-40 items-end gap-2">
          {data.map((point, i) => {
            const billedPct = (point.billed / max) * 100;
            const collectedPct = (point.collected / point.billed) * 100;
            const rate = Math.round((point.collected / point.billed) * 100);
            const monthLabel = formatDate(`${point.month}-01`, { month: "long", year: "numeric" });
            return (
              <div
                key={point.month}
                role="img"
                aria-label={`${monthLabel} — ${t("panels.billed")} ${formatMoney({ currency, amount: String(point.billed) })}, ${t("panels.collected")} ${formatMoney({ currency, amount: String(point.collected) })} (${rate}%)`}
                className="group relative flex flex-1 flex-col items-center gap-1"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {active === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-44 rounded-md bg-primary-deep px-2 py-1.5 text-[11px] text-primary-foreground shadow-menu">
                    <div className="font-bold">{monthLabel}</div>
                    <div>{t("panels.billed")}: {formatMoney({ currency, amount: String(point.billed) })}</div>
                    <div>{t("panels.collected")}: {formatMoney({ currency, amount: String(point.collected) })}</div>
                    <div className="text-primary-foreground/70">{t("panels.collection_rate", { rate })}</div>
                  </div>
                )}
                <div
                  className="flex w-full max-w-9 items-end justify-center rounded-t-[4px] bg-chart-track"
                  style={{ height: `${billedPct}%` }}
                >
                  <div
                    className="w-full rounded-t-[4px] bg-chart-fill transition-[height]"
                    style={{ height: `${collectedPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted">
                  {formatDate(`${point.month}-01`, { month: "short" })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardPanel>
  );
}
