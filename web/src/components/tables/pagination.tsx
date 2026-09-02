import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

interface PaginationProps {
  /** 1-based current page */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Numeric pager with prev/next. Direction-aware chevrons. */
export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  const { t, i18n } = useTranslation("common");
  if (pageCount <= 1) return null;

  const rtl = i18n.dir() === "rtl";
  const prevIcon = rtl ? "chevron_right" : "chevron_left";
  const nextIcon = rtl ? "chevron_left" : "chevron_right";
  const pages = pageWindow(page, pageCount);

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[12.5px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      aria-label={t("pagination.label")}
      data-slot="pagination"
      className={cn("flex items-center gap-1", className)}
    >
      <button
        type="button"
        className={cn(btn, "text-muted hover:bg-surface-subtle hover:text-foreground")}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("pagination.previous")}
      >
        <Icon name={prevIcon} size={16} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-[12.5px] text-subtle">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            className={cn(
              btn,
              p === page
                ? "bg-primary text-primary-foreground"
                : "text-foreground-body hover:bg-surface-subtle",
            )}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(btn, "text-muted hover:bg-surface-subtle hover:text-foreground")}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={t("pagination.next")}
      >
        <Icon name={nextIcon} size={16} />
      </button>
    </nav>
  );
}

/** e.g. 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}
