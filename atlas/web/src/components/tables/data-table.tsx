import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";

export interface DataColumn<T> {
  key: string;
  label: string;
  /** fixed px width */
  width?: number;
  /** flex-grow ratio (mutually exclusive with width) */
  flex?: number;
  align?: "start" | "end";
  render: (row: T) => ReactNode;
}

function colStyle<T>(c: DataColumn<T>): CSSProperties {
  if (c.width != null) return { width: c.width, flex: `0 0 ${c.width}px` };
  return { flex: c.flex ?? 1, minWidth: 0 };
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  minWidth?: number;
  className?: string;
}

/**
 * The single most-reused pattern in the app: a config-driven entity table
 * (sticky header, shimmering skeleton rows, empty state, per-column typed
 * cells). One instance of this, fed a different `columns`/`rows` pair, is
 * the entire screen for ~26 routes (every CRM/Sales/Finance/Ops/Admin list +
 * every Analytics breakdown table).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  minWidth = 720,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div style={{ minWidth }}>
        <div
          className="sticky top-0 z-[1] flex items-center gap-3 border-b border-border bg-surface-subtle px-[18px] py-2.5"
        >
          {columns.map((c) => (
            <span
              key={c.key}
              style={colStyle(c)}
              className={cn(
                "truncate whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted",
                c.align === "end" && "text-end",
              )}
            >
              {c.label}
            </span>
          ))}
        </div>

        {loading ? (
          <RowsSkeleton cols={columns.length} />
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          rows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex min-h-[34px] items-center gap-3 border-b border-border-row px-[18px] py-1.5 last:border-0",
                onRowClick && "cursor-pointer hover:bg-surface-hover",
              )}
            >
              {columns.map((c) => (
                <div key={c.key} style={colStyle(c)} className={cn("min-w-0", c.align === "end" && "text-end")}>
                  {c.render(row)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** `isText` cell — value (mono for ids/money/dates, sans for names) + optional muted sub-line. */
export function TextCell({ value, sub, mono = false, weight = "semibold" }: { value: ReactNode; sub?: ReactNode; mono?: boolean; weight?: "normal" | "semibold" | "bold" }) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "truncate text-[11.5px] text-body",
          mono && "font-mono",
          weight === "semibold" && "font-semibold",
          weight === "bold" && "font-bold",
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate text-[10px] text-subtle">{sub}</div>}
    </div>
  );
}

/** `isBadge` cell. */
export function BadgeCell({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

/** `isBar` cell — inline mini progress bar + right-aligned mono value; color by threshold. */
export function BarCell({ pct, label, thresholds = [70, 40] }: { pct: number; label: string; thresholds?: [number, number] }) {
  const color =
    pct >= thresholds[0] ? "var(--color-success)" : pct >= thresholds[1] ? "var(--color-primary)" : "var(--color-danger-solid)";
  return (
    <div className="flex items-center gap-1.5">
      <ProgressBar value={pct} color={color} className="max-w-[80px] flex-1" />
      <span className="w-8 flex-none text-end font-mono text-[10px] text-secondary">{label}</span>
    </div>
  );
}
