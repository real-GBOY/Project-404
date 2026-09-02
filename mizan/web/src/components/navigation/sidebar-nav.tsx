import { useCallback, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV } from "@/app/router/nav";
import type { NavItem } from "@/app/router/nav";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUnreadNotificationsCount } from "@/features/notifications/hooks/use-notifications";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

const OPEN_KEY = "mizan.sidebar.groups";

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Permission-aware primary nav — the prototype's collapsible groups. Items the
 * session can't `read` are hidden; an empty group is dropped. Gating is UX only.
 */
export function SidebarNav() {
  const { can } = usePermissions();
  const { t } = useTranslation("common");
  const { pathname } = useLocation();
  const unread = useUnreadNotificationsCount();
  const [open, setOpen] = useState(readOpen);

  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: prev[key] === false };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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
    <nav aria-label={t("shell.primary_nav")} className="flex flex-col gap-2.5">
      {visible.map((group, i) => {
        const key = group.titleKey ?? `lead-${i}`;
        const expanded = open[key] !== false;
        return (
          <div key={key} className="flex flex-col gap-0.5">
            {group.titleKey && (
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={expanded}
                className="flex select-none items-center justify-between px-2.5 pb-1.5 pt-2.5"
              >
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
                  {t(`nav.groups.${group.titleKey}`)}
                </span>
                <Icon
                  name={expanded ? "expand_less" : "expand_more"}
                  size={16}
                  className="text-[#bebecc]"
                />
              </button>
            )}
            {expanded &&
              group.items.map((item) => {
                const active = isActive(item);
                const badge =
                  item.labelKey === "notifications" && unread > 0 ? String(unread) : null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-[11px] rounded-btn px-[11px] py-[9px] text-[13.5px] transition-colors",
                      active
                        ? "bg-surface-sand font-bold text-link"
                        : "font-semibold text-secondary hover:bg-surface-subtle hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute -start-3 bottom-[9px] top-[9px] w-[3px] rounded-e bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      name={item.icon}
                      size={19}
                      className={active ? "" : "text-muted group-hover:text-foreground"}
                    />
                    <span className="flex-1 truncate">{t(`nav.${item.labelKey}`)}</span>
                    {badge && (
                      <span
                        className={cn(
                          "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-bold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-danger-surface text-danger",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
