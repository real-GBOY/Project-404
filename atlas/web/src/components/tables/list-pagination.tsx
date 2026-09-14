import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export function ListFooter({ total, page, pageSize, onPageChange }: { total: number; page: number; pageSize: number; onPageChange: (p: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center gap-2.5 border-t border-border bg-surface-subtle px-[18px] py-2">
      <span className="text-[10.5px] text-secondary">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
        className="flex size-6 items-center justify-center rounded-sm border border-border text-subtle disabled:opacity-40"
      >
        <Icon name="chevron-left" size={12} />
      </button>
      <span className="font-mono text-[11px]">{page}</span>
      <span className="text-[11px] text-subtle">/ {pageCount}</span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
        className={cn("flex size-6 items-center justify-center rounded-sm border border-border text-secondary disabled:opacity-40")}
      >
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  );
}
