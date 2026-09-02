import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { PanelHeader } from "@/components/tables/list-card";
import { formatNumber } from "@/lib/format";
import type { PracticeAreaSlice } from "../types/dashboard";

/** The prototype's espresso→sand ramp for the practice-area donut. */
const RAMP = ["#3b2418", "#a67c52", "#be9a6b", "#d4b98f", "#ede3db"];

/**
 * Open matters by practice area — a conic donut with a legend, matching the
 * prototype. One entity per slice, fixed order, never a generated hue: a 6th
 * area folds into "Other" (dataviz non-negotiable).
 */
export function PracticeAreaChart({ data }: { data: PracticeAreaSlice[] }) {
  const { t } = useTranslation("dashboard");

  const top = data.slice(0, 4);
  const rest = data.slice(4).reduce((s, d) => s + d.matters, 0);
  const slices = rest > 0 ? [...top, { area: t("panels.other"), matters: rest }] : top;
  const total = slices.reduce((s, d) => s + d.matters, 0) || 1;

  let acc = 0;
  const stops = slices
    .map((s, i) => {
      const from = (acc / total) * 100;
      acc += s.matters;
      const to = (acc / total) * 100;
      return `${RAMP[i] ?? RAMP[RAMP.length - 1]} ${from}% ${to}%`;
    })
    .join(", ");

  return (
    <Card>
      <PanelHeader icon="donut_small" title={t("panels.practice_areas")} />
      <div className="flex items-center gap-[22px] p-[18px]">
        <div
          className="grid size-[132px] flex-none place-items-center rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
          role="img"
          aria-label={slices.map((s) => `${s.area}: ${s.matters}`).join(", ")}
        >
          <div className="grid size-[92px] place-items-center rounded-full bg-surface text-center">
            <div>
              <div className="text-[22px] font-extrabold tracking-[-0.03em] text-foreground">
                {formatNumber(total)}
              </div>
              <div className="text-[10.5px] font-semibold text-muted">
                {t("panels.open_matters")}
              </div>
            </div>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-[9px]">
          {slices.map((s, i) => (
            <li key={s.area} className="flex items-center gap-2.5">
              <span
                className="size-[9px] flex-none rounded-[3px]"
                style={{ background: RAMP[i] ?? RAMP[RAMP.length - 1] }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-[12.5px] font-semibold text-foreground-body">
                {s.area}
              </span>
              <span className="text-[12.5px] font-extrabold text-foreground">
                {formatNumber(s.matters)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
