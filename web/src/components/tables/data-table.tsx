import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";

export interface Column<Row> {
  id: string;
  header: ReactNode;
  /** cell renderer */
  cell: (row: Row) => ReactNode;
  /** enable the sort affordance on this column's header */
  sortable?: boolean;
  align?: "start" | "end" | "center";
  /** fixed width, e.g. "8rem" */
  width?: string;
  /** hide below the given breakpoint */
  hideBelow?: "sm" | "md" | "lg";
}

export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  isLoading?: boolean;
  /** shown when rows is empty and not loading */
  empty?: ReactNode;
  caption?: string;
  className?: string;
}

const HIDE_CLASS = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

const ALIGN_CLASS = {
  start: "text-start",
  end: "text-end",
  center: "text-center",
} as const;

/**
 * Presentational table — sort/paginate state is owned by the caller (URL params).
 * For the grid view, the feature renders its own card layout; this is the table.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  isLoading,
  empty,
  caption,
  className,
}: DataTableProps<Row>) {
  const { t } = useTranslation("common");

  function toggleSort(col: Column<Row>) {
    if (!col.sortable || !onSortChange) return;
    const direction: SortState["direction"] =
      sort?.column === col.id && sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ column: col.id, direction });
  }

  if (isLoading) return <RowsSkeleton rows={6} />;

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-[13px]" data-slot="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isSorted = sort?.column === col.id;
              return (
                <th
                  key={col.id}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  aria-sort={
                    isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 text-[11.5px] font-semibold text-muted",
                    ALIGN_CLASS[col.align ?? "start"],
                    col.hideBelow && HIDE_CLASS[col.hideBelow],
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex items-center gap-1 font-semibold hover:text-foreground-body"
                    >
                      {col.header}
                      <Icon
                        name={
                          isSorted
                            ? sort.direction === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"
                        }
                        size={13}
                        className={isSorted ? "text-foreground-body" : "text-subtle"}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                "border-b border-divider last:border-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                onRowClick && "cursor-pointer hover:bg-surface-subtle",
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    "px-3 py-2.5 text-foreground-body",
                    ALIGN_CLASS[col.align ?? "start"],
                    col.hideBelow && HIDE_CLASS[col.hideBelow],
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-[13px] text-muted">
                {t("states.empty_title")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
