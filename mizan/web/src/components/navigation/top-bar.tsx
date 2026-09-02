import { useTranslation } from "react-i18next";
import { useBreadcrumbs } from "@/app/router/use-breadcrumbs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { TooltipHint } from "@/components/ui/tooltip";
import { AskMizan } from "@/features/assistant/components/ask-mizan";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";

interface TopBarProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export function TopBar({ onOpenSearch, onToggleSidebar }: TopBarProps) {
  const { t } = useTranslation("common");
  const crumbs = useBreadcrumbs();

  return (
    <header className="sticky top-0 z-20 flex h-topbar flex-none items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <IconButton
        icon="menu"
        aria-label={t("shell.toggle_sidebar")}
        onClick={onToggleSidebar}
        className="lg:hidden"
      />

      <Breadcrumb items={crumbs} className="min-w-0 flex-1" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-9 items-center gap-2 rounded-md border border-border-control bg-surface-subtle px-2.5 text-[12.5px] text-muted hover:bg-surface md:flex"
      >
        <Icon name="search" size={15} />
        <span>{t("shell.search")}</span>
        <kbd className="ms-2 rounded border border-border-control bg-surface px-1 text-[10px] font-semibold text-subtle">
          ⌘K
        </kbd>
      </button>

      <IconButton
        icon="search"
        aria-label={t("shell.search")}
        onClick={onOpenSearch}
        className="md:hidden"
      />

      <AskMizan />

      <TooltipHint label={t("shell.help")}>
        <a
          href="https://mizan.help"
          target="_blank"
          rel="noreferrer"
          aria-label={t("shell.help")}
          className="flex size-9 items-center justify-center rounded-md text-foreground-body hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="help" size={19} />
        </a>
      </TooltipHint>

      <NotificationsBell />

      <div className="mx-1 h-6 w-px bg-divider" />

      <UserMenu />
    </header>
  );
}
