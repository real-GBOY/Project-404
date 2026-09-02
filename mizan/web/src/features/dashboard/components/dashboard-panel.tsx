import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

interface DashboardPanelProps {
  title: string;
  icon: string;
  /** route for a "view all" affordance in the header */
  viewAllTo?: string;
  count?: number;
  children: ReactNode;
  className?: string;
}

export function DashboardPanel({
  title,
  icon,
  viewAllTo,
  count,
  children,
  className,
}: DashboardPanelProps) {
  const { t } = useTranslation("common");
  return (
    <section
      className={cn("flex flex-col rounded-lg border border-border bg-surface shadow-card", className)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} className="text-muted" />
          <h2 className="text-[13px] font-bold text-foreground">{title}</h2>
          {count != null && (
            <span className="rounded-pill bg-surface-subtle px-1.5 text-[11px] font-semibold text-muted">
              {count}
            </span>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-link hover:underline"
          >
            {t("dashboard.view_all")}
            <Icon name="chevron_right" size={13} className="rtl:rotate-180" />
          </Link>
        )}
      </header>
      <div className="flex-1 p-2">{children}</div>
    </section>
  );
}

/** Empty line inside a panel. */
export function PanelEmpty({ label }: { label: string }) {
  return <p className="px-2 py-6 text-center text-[12px] text-muted">{label}</p>;
}
