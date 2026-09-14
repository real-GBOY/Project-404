import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Dashed-box empty state — always explains WHY it's empty and what to do next. */
export function EmptyState({ icon = "search", title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 px-6 py-[54px] text-center"
      data-slot="empty-state"
    >
      <div className="flex size-10 items-center justify-center rounded-card border border-dashed border-faint text-[#B5B5AE]">
        <Icon name={icon} size={18} />
      </div>
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {description && (
        <p className="max-w-[390px] text-[11.5px] leading-relaxed text-secondary">{description}</p>
      )}
      {action && <div className="mt-0.5 flex items-center gap-1.5">{action}</div>}
    </div>
  );
}
