import { cn } from "@/lib/cn";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import type { DataTableProps } from "./data-table";

/**
 * Card-grid counterpart to `DataTable` — same props, so `EntityTablePage`
 * can swap between the two on `ViewToggle` without touching a column config.
 * Each card lists every column as a label/value pair (using the column's own
 * `render`), since a grid has no header row to carry the labels instead.
 */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  className,
}: DataTableProps<T>) {
  if (loading) return <RowsSkeleton cols={columns.length} />;
  if (rows.length === 0) return <EmptyState icon="search" title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  return (
    <div className={cn("grid grid-cols-1 gap-2.5 p-2.5 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {rows.map((row) => (
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
            "flex flex-col gap-1.5 rounded-lg border border-border-row bg-surface px-3 py-2.5",
            onRowClick && "cursor-pointer hover:bg-surface-hover",
          )}
        >
          {columns.map((c) => (
            <div key={c.key} className="flex items-baseline justify-between gap-3">
              <span className="flex-none text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{c.label}</span>
              <div className="min-w-0 text-end">{c.render(row)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
