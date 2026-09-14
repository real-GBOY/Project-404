import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

/** The design's card surface: white, 1px border, 3px radius, no shadow. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn("overflow-hidden rounded-card border border-border bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center gap-2.5 border-b border-border-row px-3 py-2.5", className)}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold text-foreground">{title}</div>
        {subtitle && <div className="mt-0.5 text-[10px] text-subtle">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[11px] text-primary hover:underline">
      {children}
    </Link>
  );
}
