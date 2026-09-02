import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

interface StatCardProps {
  label: string;
  /** primary value — a string, or stacked lines for per-currency money */
  value: ReactNode | string[];
  icon?: string;
  /** optional trend/context line under the value */
  hint?: ReactNode;
  trend?: { direction: "up" | "down"; label: string };
  className?: string;
}

/**
 * Dashboard KPI tile. Money must be passed as `string[]` (one line per currency)
 * — never summed across currencies (PLAN §6).
 */
export function StatCard({ label, value, icon, hint, trend, className }: StatCardProps) {
  const lines = Array.isArray(value) ? value : null;
  return (
    <div
      data-slot="stat-card"
      className={cn("rounded-lg border border-border bg-surface p-4 shadow-card", className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted">{label}</span>
        {icon && (
          <span className="flex size-7 items-center justify-center rounded-md bg-surface-sand text-link">
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-0.5">
        {lines ? (
          lines.map((line) => (
            <span key={line} className="text-[17px] font-extrabold tracking-tight text-foreground">
              {line}
            </span>
          ))
        ) : (
          <span className="text-[22px] font-extrabold tracking-tight text-foreground">{value}</span>
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold",
            trend.direction === "up" ? "text-success" : "text-danger",
          )}
        >
          <Icon name={trend.direction === "up" ? "trending_up" : "trending_down"} size={14} />
          {trend.label}
        </div>
      )}
      {hint && <div className="mt-1.5 text-[11.5px] text-muted">{hint}</div>}
    </div>
  );
}
