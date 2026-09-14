import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  below?: ReactNode;
  className?: string;
}

/** Screen title row — `18-19px/600/-.02em` heading + muted 11px subtitle + trailing actions. */
export function PageHeader({ title, description, actions, below, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-3.5 flex flex-col gap-3", className)} data-slot="page-header">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-[11px] text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {below}
    </div>
  );
}

/** Standard screen wrapper padding: `16px 18px 40px`. */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-[18px] pb-10 pt-4", className)} {...props} />;
}
