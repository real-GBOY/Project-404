import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** right-aligned actions (primary button, filters trigger, view toggle) */
  actions?: ReactNode;
  /** tabs / segmented control rendered on their own row below the title */
  below?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, below, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="page-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[19px] font-extrabold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          {description && <p className="text-[13px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
      </div>
      {below}
    </div>
  );
}
