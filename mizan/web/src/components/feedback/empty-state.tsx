import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  /** primary next action — pass only when the user is allowed to take it */
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center"
      data-slot="empty-state"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-surface-sand text-link">
        <Icon name={icon} size={24} />
      </div>
      <div className="text-[15px] font-bold text-foreground">{title}</div>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
