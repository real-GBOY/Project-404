import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV } from "@/app/router/nav";
import type { NavItem } from "@/app/router/nav";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Permission-aware primary navigation. Items the session can't `read` are
 * hidden; a group with nothing visible is dropped. Gating is UX only.
 */
export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const { can } = usePermissions();
  const { t } = useTranslation("common");
  const { pathname } = useLocation();

  const isActive = (item: NavItem) => {
    if (item.to === "/") return pathname === "/";
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return true;
    return (item.match ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };

  const visible = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.perm === null || can(item.perm)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label={t("shell.primary_nav")} className="flex flex-col gap-4">
      {visible.map((group, i) => (
        <div key={group.titleKey ?? `lead-${i}`} className="flex flex-col gap-0.5">
          {group.titleKey && !collapsed && (
            <div className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-subtle">
              {t(`nav.groups.${group.titleKey}`)}
            </div>
          )}
          {group.items.map((item) => {
            const active = isActive(item);
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-surface-sand text-link"
                    : "text-foreground-body hover:bg-surface-subtle",
                )}
              >
                <Icon
                  name={item.icon}
                  size={19}
                  filled={active}
                  className={active ? "text-link" : "text-muted group-hover:text-foreground-body"}
                />
                {!collapsed && <span className="truncate">{t(`nav.${item.labelKey}`)}</span>}
              </NavLink>
            );

            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{t(`nav.${item.labelKey}`)}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}
