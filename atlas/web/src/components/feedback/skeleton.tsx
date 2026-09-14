import { cn } from "@/lib/cn";

/** A shimmering placeholder block — the design's own `shimmer` keyframe, not `animate-pulse`. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("rounded-sm bg-surface-subtle-2", className)}
      style={{ animation: "shimmer 1.3s infinite", ...style }}
      aria-hidden="true"
      data-slot="skeleton"
    />
  );
}

/** Generic shimmering table-row skeleton — matches the generic DataTable's own loading rows. */
export function RowsSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ["70%", "45%", "60%", "35%", "50%", "40%"];
  return (
    <div role="status" aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-border-row px-[18px] py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-[9px] flex-1" style={{ maxWidth: widths[c % widths.length] }} />
          ))}
        </div>
      ))}
    </div>
  );
}
