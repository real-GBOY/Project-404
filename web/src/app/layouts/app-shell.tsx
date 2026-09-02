import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "@/app/router/nav";
import { RouteErrorBoundary } from "@/app/router/route-error-boundary";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandMenu, type CommandAction } from "@/components/navigation/command-menu";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { TopBar } from "@/components/navigation/top-bar";

const COLLAPSE_KEY = "mizan.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("common");
  return (
    <div className={cn("flex items-center gap-2.5 px-4 py-4", compact && "justify-center px-0")}>
      <div className="flex size-8 flex-none items-center justify-center rounded-[11px] bg-primary text-[15px] font-extrabold text-primary-foreground">
        M
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold tracking-tight">{t("app_name")}</div>
          <div className="truncate text-[11px] font-medium text-muted">{t("shell.firm_name")}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Application shell — 246px sidebar + 64px top bar + routed content.
 * The sidebar collapses to icons on desktop (persisted) and becomes a drawer
 * below `lg`. ⌘K opens the command menu.
 */
export function AppShell() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Global ⌘K / Ctrl+K.
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
    <div className="flex min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh flex-none flex-col border-e border-border bg-surface lg:flex",
          collapsed ? "w-16" : "w-sidebar",
        )}
      >
        <Brand compact={collapsed} />
        <div className="border-b border-divider" />
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("shell.expand_sidebar") : t("shell.collapse_sidebar")}
          className="m-3 flex items-center justify-center gap-2 rounded-md border border-border-control py-2 text-[12px] font-semibold text-muted hover:bg-surface-subtle"
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size={16} className="rtl:rotate-180" />
          {!collapsed && t("shell.collapse")}
        </button>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="start" className="w-[17rem] p-0">
          <SheetTitle className="sr-only">{t("shell.primary_nav")}</SheetTitle>
          <Brand />
          <div className="border-b border-divider" />
          <div className="overflow-y-auto p-3">
            <SidebarNav />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSearch={() => setCommandOpen(true)} onToggleSidebar={() => setDrawerOpen(true)} />
        <main className="flex-1">
          <RouteErrorBoundary>
            <Suspense fallback={<div className="p-6"><RowsSkeleton /></div>}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} actions={commandActions} />
    </div>
  );
}
