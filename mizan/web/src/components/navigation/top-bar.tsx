import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/app/router/nav";
import { usePageChrome } from "@/lib/page-chrome";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { AskMizan } from "@/features/assistant/components/ask-mizan";
import { NotificationsBell } from "./notifications-bell";

interface TopBarProps {
  onToggleSidebar: () => void;
}

/**
 * The prototype top bar: `h:64px; border-bottom:1px solid #ECECF1;
 * padding-inline:26px`. Left — optional breadcrumb parent, the page title
 * (17px / 800), an optional count pill. Right — Ask Mizan, help, notifications.
 */
export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { t } = useTranslation("common");
  const { pathname } = useLocation();
  const chrome = usePageChrome();

  // Nav-derived default when a page hasn't declared its own chrome.
  const fallback = useMemo(() => {
    const match = NAV_ITEMS.filter(
      (i) => pathname === i.to || (i.to !== "/" && pathname.startsWith(i.to)),
    ).sort((a, b) => b.to.length - a.to.length)[0];
    return { title: match ? t(`nav.${match.labelKey}`) : t("nav.dashboard") };
  }, [pathname, t]);

  const title = chrome?.title ?? fallback.title;
  const count = chrome?.count ?? null;
  const parent = chrome?.parent ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-topbar flex-none items-center justify-between gap-3 border-b border-border bg-surface px-[26px]">
      <div className="flex min-w-0 items-center gap-[9px]">
        <IconButton
          icon="menu"
          aria-label={t("shell.toggle_sidebar")}
          onClick={onToggleSidebar}
          className="-ms-2 lg:hidden"
        />
        {parent && (
          <>
            <Link
              to={parent.to}
              className="text-[16px] font-semibold text-subtle transition-colors hover:text-foreground"
            >
              {parent.label}
            </Link>
            <Icon name="chevron_right" size={18} className="text-fainter rtl:rotate-180" />
          </>
        )}
        <span className="truncate text-[17px] font-extrabold tracking-[-0.015em] text-foreground">
          {title}
        </span>
        {count != null && count !== "" && (
          <span className="flex-none rounded-pill bg-divider-faint px-[9px] py-[3px] text-[12.5px] font-bold text-muted">
            {count}
          </span>
        )}
      </div>

      <div className="flex flex-none items-center gap-[9px]">
        <AskMizan />
        <a
          href="https://mizan.help"
          target="_blank"
          rel="noreferrer"
          aria-label={t("shell.help")}
          className="flex size-9 items-center justify-center rounded-btn border border-border-tab text-secondary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="help_outline" size={19} />
        </a>
        <NotificationsBell />
      </div>
    </header>
  );
}
