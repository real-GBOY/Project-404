import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

/**
 * The prototype's list surface: a `Card` with `overflow:hidden` holding a
 * toolbar row, an optional column-header row (`#FAFAFC`), flex body rows, and a
 * footer. Every list screen (clients, matters, hearings, tasks, documents,
 * billing, payments, expenses, team) is built from these.
 */
export function ListCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-card"
      className={cn("overflow-hidden rounded-card border border-border bg-surface", className)}
      {...props}
    />
  );
}

/**
 * Panel header — `icon 19 + title 14/800 + trailing`. The prototype's every
 * card/panel header (`padding:14–15px 18px; border-bottom:1px solid #F2F2F6`).
 */
export function PanelHeader({
  icon,
  iconClassName,
  title,
  action,
  className,
}: {
  icon?: string;
  iconClassName?: string;
  title: ReactNode;
  /** right-aligned: a "See all" link, a pill, a count */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex items-center gap-2.5 border-b border-divider px-[18px] py-[15px]",
        className,
      )}
    >
      {icon && <Icon name={icon} size={19} className={cn("text-primary", iconClassName)} />}
      <span className="flex-1 text-[14px] font-extrabold text-foreground">{title}</span>
      {action}
    </div>
  );
}

/** "See all" / "Open finance" trailing link — `12px / 700 / link`. */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[12px] font-bold text-link hover:underline">
      {children}
    </Link>
  );
}

/** Toolbar row — `padding:14px 16px; border-bottom:1px solid #F2F2F6`. */
export function ListToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2.5 border-b border-divider px-4 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export interface ListColumn {
  key: string;
  label: ReactNode;
  /** fixed px width */
  width?: number;
  /** flex-grow ratio (mutually exclusive with width) */
  flex?: number;
  align?: "start" | "end";
}

function colStyle(c: ListColumn): CSSProperties {
  if (c.width != null) return { width: c.width, flex: `0 0 ${c.width}px` };
  return { flex: c.flex ?? 1, minWidth: 0 };
}

/** Uppercase column-header row — `#FAFAFC`, `11px/700/0.04em`, `padding:10px 18px`. */
export function ColumnHeader({
  columns,
  className,
}: {
  columns: ListColumn[];
  className?: string;
}) {
  return (
    <div
      data-slot="column-header"
      className={cn(
        "flex items-center gap-3 border-b border-divider-row-2 bg-surface-subtle px-[18px] py-2.5",
        className,
      )}
    >
      {columns.map((c) => (
        <span
          key={c.key}
          style={colStyle(c)}
          className={cn(
            "truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.04em] text-muted",
            c.align === "end" && "text-end",
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** Body row — flex, `gap:12px; padding:13px 18px; border-bottom:1px solid #F5F5F8`. */
export function ListRow({
  onClick,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-row"
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                (onClick as () => void)();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "flex items-center gap-3 border-b border-divider-row px-[18px] py-[13px] last:border-0",
        onClick &&
          "cursor-pointer hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** One flex cell inside a `ListRow`, aligned to a `ListColumn`. */
export function Cell({
  col,
  className,
  children,
  ...props
}: { col: ListColumn } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={colStyle(col)}
      className={cn(
        "min-w-0 text-[12.5px] font-semibold text-secondary",
        col.align === "end" && "text-end",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Footer row — pagination / "Showing 1–8 of 48". `padding:13px 18px`. */
export function ListFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="list-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-divider px-[18px] py-[13px]",
        className,
      )}
      {...props}
    />
  );
}

/** The prototype's list search box — sand fill, `#EDEDF2` border, leading glyph. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[280px] items-center gap-2 rounded-btn border border-border-input bg-[#f7f7fa] px-[11px] py-2",
        className,
      )}
    >
      <Icon name="search" size={18} className="flex-none text-subtle" />
      <input
        type="search"
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[12.5px] font-medium text-foreground outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}

/** Plain toolbar button — `h-9; border; rounded-btn; 12.5/700` + optional icon / count. */
export function ToolbarButton({
  icon,
  count,
  children,
  className,
  ...props
}: { icon?: string; count?: number | string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 items-center gap-[7px] rounded-btn border border-border-control px-[13px] text-[12.5px] font-bold text-foreground transition-colors hover:bg-surface-subtle",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={17} className="text-muted" />}
      {children}
      {count != null && (
        <span className="rounded-pill bg-surface-sand px-[7px] py-px text-[11px] text-link">
          {count}
        </span>
      )}
    </button>
  );
}

/** Table / grid icon toggle — `#F1E8D9` on the active side. */
export function ViewToggle({
  value,
  onChange,
  labels,
}: {
  value: "table" | "grid";
  onChange: (v: "table" | "grid") => void;
  labels: { table: string; grid: string };
}) {
  return (
    <div className="flex h-9 overflow-hidden rounded-btn border border-border-control">
      {(["table", "grid"] as const).map((v, i) => (
        <button
          key={v}
          type="button"
          aria-label={labels[v]}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex w-[38px] items-center justify-center transition-colors",
            i === 1 && "border-s border-border-control",
            value === v ? "bg-surface-sand text-link" : "text-muted hover:bg-surface-subtle",
          )}
        >
          <Icon name={v === "table" ? "table_rows" : "grid_view"} size={18} />
        </button>
      ))}
    </div>
  );
}

/** Prototype pagination — 30px squares, active espresso. Renders nothing for ≤1 page. */
export function ListPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const cell =
    "flex size-[30px] items-center justify-center rounded-lg text-[12.5px] font-bold transition-colors";
  const nums: number[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) nums.push(p);
  }
  return (
    <nav className="flex items-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous"
        className={cn(cell, "border border-border-tab text-faint disabled:opacity-40")}
      >
        <Icon name="chevron_left" size={17} className="rtl:rotate-180" />
      </button>
      {nums.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - nums[i - 1] > 1 && <span className="text-[12px] text-faint">…</span>}
          <button
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              cell,
              p === page
                ? "bg-primary text-primary-foreground"
                : "border border-border-tab text-secondary hover:bg-surface-subtle",
            )}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next"
        className={cn(cell, "border border-border-tab text-secondary disabled:opacity-40")}
      >
        <Icon name="chevron_right" size={17} className="rtl:rotate-180" />
      </button>
    </nav>
  );
}
