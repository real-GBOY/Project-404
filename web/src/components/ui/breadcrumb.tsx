import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface Crumb {
  label: string;
  to?: string;
}

/** Route breadcrumb. The last crumb is the current page (no link). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const { i18n } = useTranslation();
  const chevron = i18n.dir() === "rtl" ? "chevron_left" : "chevron_right";

  return (
    <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-[12.5px] text-muted">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className={cn(isLast && "font-semibold text-foreground-body")}>
                {item.to && !isLast ? (
                  <Link to={item.to} className="hover:text-foreground-body hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                )}
              </li>
              {!isLast && <Icon name={chevron} size={14} className="text-subtle" />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
