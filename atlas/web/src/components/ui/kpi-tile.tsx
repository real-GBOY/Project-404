import { cn } from "@/lib/cn";

export interface Spark {
  /** 0-100 height percent */
  h: number;
}

export interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  deltaSign?: "up" | "down" | "flat";
  spark?: Spark[];
  className?: string;
  /** compact variant used inside table/customer/project/analytics KPI strips */
  compact?: boolean;
}

const DELTA_COLOR: Record<NonNullable<KpiTileProps["deltaSign"]>, string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-muted",
};

const SPARK_COLOR: Record<NonNullable<KpiTileProps["deltaSign"]>, string> = {
  up: "bg-spark-positive",
  down: "bg-spark-negative",
  flat: "bg-spark-neutral",
};

/** One tile in a KPI strip. Tiles share a 1px-gap grid against a border-colored
 *  backdrop so adjacent tiles read as separated without each carrying its own border. */
export function KpiTile({ label, value, delta, deltaSign = "flat", spark, className, compact = false }: KpiTileProps) {
  return (
    <div className={cn("min-w-0 bg-surface transition-colors hover:bg-surface-subtle", compact ? "px-3 py-2.5" : "px-3 py-2.5 pb-2.5", className)}>
      <div className="truncate text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <div className={cn("whitespace-nowrap font-semibold tracking-[-0.02em]", compact ? "text-[14px]" : "text-[17px]")}>
          {value}
        </div>
        {delta && <div className={cn("text-[10.5px] font-semibold", DELTA_COLOR[deltaSign])}>{delta}</div>}
      </div>
      {spark && !compact && (
        <div className="mt-2 flex h-[18px] items-end gap-0.5">
          {spark.map((s, i) => (
            <div
              key={i}
              className={cn("min-h-0.5 flex-1 rounded-[1px]", SPARK_COLOR[deltaSign])}
              style={{ height: `${Math.max(6, s.h)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Wraps a row of `KpiTile`s in the 1px-gap "seamless separated tiles" grid trick. */
export function KpiStrip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-card border border-border bg-border",
        "grid-cols-[repeat(auto-fit,minmax(150px,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
