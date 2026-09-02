import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/app/router/nav";
import { RouteErrorBoundary } from "@/app/router/route-error-boundary";
import { PageChromeProvider } from "@/lib/page-chrome";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandMenu, type CommandAction } from "@/components/navigation/command-menu";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { TopBar } from "@/components/navigation/top-bar";
import { UserMenu } from "@/components/navigation/user-menu";

function Brand() {
  const { t } = useTranslation("common");
  return (
    <div className="flex items-center gap-2.5 border-b border-divider-brand px-[18px] pb-4 pt-[18px]">
      <div className="flex size-[34px] flex-none items-center justify-center rounded-group bg-primary text-[16px] font-extrabold text-primary-foreground">
        M
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold tracking-[-0.015em]">{t("app_name")}</div>
        <div className="truncate text-[11px] font-medium text-muted">{t("shell.firm_name")}</div>
      </div>
    </div>
  );
}

function SidebarSearch({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-btn border border-border-input bg-[#f7f7fa] px-2.5 py-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name="search" size={18} className="text-subtle" />
      <span className="truncate text-[12.5px] font-medium text-subtle">{t("shell.search_hint")}</span>
    </button>
  );
}

function SidebarInner({ onSearch }: { onSearch: () => void }) {
  return (
    <>
      <Brand />
      <div className="px-3.5 pb-1 pt-3.5">
        <SidebarSearch onClick={onSearch} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-2 pt-2.5">
        <SidebarNav />
      </div>
      <div className="px-3 pb-3.5 pt-2.5">
        <UserMenu />
      </div>
    </>
  );
}

/**
 * Application shell — 246px sidebar + 64px top bar + routed content, matching the
 * Claude Design prototype. The sidebar is a drawer below `lg`. ⌘K opens the
 * command menu (also reachable from the sidebar search field).
 */
export function AppShell() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commandActions = useMemo<CommandAction[]>(
    () =>
      NAV_ITEMS.filter((item) => item.perm === null || can(item.perm)).map((item) => ({
        id: `nav:${item.to}`,
        label: t(`nav.${item.labelKey}`),
        group: t("command.groups.navigate"),
        icon: item.icon,
        perform: () => navigate(item.to),
      })),
    [can, navigate, t],
  );

  return (
    <PageChromeProvider>
      <div className="flex min-h-dvh bg-canvas">
        <aside className="sticky top-0 hidden h-dvh w-sidebar flex-none flex-col border-e border-border bg-surface lg:flex">
          <SidebarInner onSearch={() => setCommandOpen(true)} />
        </aside>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="start" className="flex w-sidebar flex-col p-0">
            <SheetTitle className="sr-only">{t("shell.primary_nav")}</SheetTitle>
            <SidebarInner
              onSearch={() => {
                setDrawerOpen(false);
                setCommandOpen(true);
              }}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onToggleSidebar={() => setDrawerOpen(true)} />
          <main className="flex-1">
            <RouteErrorBoundary>
              <Suspense fallback={<div className="p-[26px] pt-6"><RowsSkeleton /></div>}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>

        <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} actions={commandActions} />
      </div>
    </PageChromeProvider>
  );
}
