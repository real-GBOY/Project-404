import { useTranslation } from "react-i18next";
import { formatNumber } from "@/lib/format";
import { DashboardPanel, PanelEmpty } from "./dashboard-panel";
import type { PracticeAreaSlice } from "../types/dashboard";

/**
 * Open matters by practice area — magnitude comparison, one series, so
 * horizontal bars in a single hue with a direct value on each (dataviz:
 * choosing-a-form → bars; no categorical palette needed).
 */
export function PracticeAreaChart({ data }: { data: PracticeAreaSlice[] }) {
  const { t } = useTranslation("dashboard");
  const max = Math.max(1, ...data.map((d) => d.matters));

  return (
    <DashboardPanel title={t("panels.practice_areas")} icon="donut_small">
      {data.length === 0 ? (
        <PanelEmpty label={t("panels.no_matters")} />
      ) : (
        <ul className="flex flex-col gap-2 p-2">
          {data.map((slice) => (
            <li key={slice.area} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <span className="truncate text-[12px] font-medium text-foreground-body">
                {slice.area}
              </span>
              <span className="h-2.5 rounded-full bg-chart-track" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-chart-fill"
                  style={{ width: `${(slice.matters / max) * 100}%` }}
                />
              </span>
              <span className="text-[12px] font-bold tabular-nums text-foreground">
                {formatNumber(slice.matters)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
