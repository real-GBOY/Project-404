import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type Tone = "default" | "success" | "warning" | "danger" | "brand" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  brand: "text-link",
  muted: "text-muted-2",
};

interface StatCardProps {
  label: string;
  /** primary value — a string/number, or stacked lines for per-currency money */
  value: ReactNode | string[];
  /** trailing unit rendered small + muted after the value (e.g. "hrs", "/hr") */
  unit?: string;
  /** leading icon — switches the label to the icon+label row of the dashboard KPIs */
  icon?: string;
  /** context line under the value */
  sub?: ReactNode;
  subTone?: Tone;
  valueTone?: Tone;
  /** 22px · 24px · 28px value — `sm` list KPI, `md` section KPI, `lg` dashboard KPI */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * KPI tile — the prototype's stat cards. Money must arrive as `string[]`
 * (one line per currency) and is never summed across currencies (PLAN §6).
 */
export function StatCard({
  label,
  value,
  unit,
  icon,
  sub,
  subTone = "muted",
  valueTone = "default",
  size = "sm",
  className,
}: StatCardProps) {
  const lines = Array.isArray(value) ? value : null;
  const valueSize =
    size === "lg" ? "text-[28px]" : size === "md" ? "text-[24px]" : "text-[22px]";
  const pad = size === "sm" ? "px-[17px] py-[15px]" : "px-[18px] py-4";

  return (
    <div
      data-slot="stat-card"
      className={cn("rounded-card border border-border bg-surface", pad, className)}
    >
      {icon ? (
        <div className="mb-3 flex items-center gap-2.5">
          <Icon name={icon} size={19} className="text-primary" />
          <span className="text-[12.5px] font-bold text-secondary">{label}</span>
        </div>
      ) : (
        <div className="mb-2 text-[12px] font-bold text-secondary">{label}</div>
      )}

      {lines ? (
        <div className="flex flex-col gap-0.5">
          {lines.map((line) => (
            <span
              key={line}
              className={cn(
                valueSize,
                "font-extrabold tracking-[-0.03em]",
                TONE_TEXT[valueTone],
              )}
            >
              {line}
            </span>
          ))}
        </div>
      ) : (
        <div
          className={cn(valueSize, "font-extrabold tracking-[-0.03em]", TONE_TEXT[valueTone])}
        >
          {value}
          {unit && <span className="ms-1 text-[14px] font-bold text-muted">{unit}</span>}
        </div>
      )}

      {sub && (
        <div className={cn("mt-1.5 text-[11.5px] font-semibold", TONE_TEXT[subTone])}>{sub}</div>
      )}
    </div>
  );
}
