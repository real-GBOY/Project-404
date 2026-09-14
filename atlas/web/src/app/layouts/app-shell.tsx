import { Suspense, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageChromeProvider } from "@/lib/page-chrome";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopBar } from "@/components/navigation/top-bar";
import { CommandPalette } from "@/components/navigation/command-palette";
import { NotificationsDrawer } from "@/components/navigation/notifications-drawer";
import { RouteErrorBoundary } from "@/app/router/route-error-boundary";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { createGlobalSearch } from "@/features/shared/global-search";

function useViewport() {
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return vw;
}

/**
 * Fixed-viewport shell: 232px sidebar + 46px top bar + routed content, only
 * inner panels scroll (matches the design's `height:100vh;overflow:hidden`
 * root grid). Sidebar auto-collapses below 1100px, the header hamburger
 * re-opens it as an on-demand toggle below that breakpoint (PLAN §2).
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const vw = useViewport();
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const search = useMemo(() => createGlobalSearch(navigate), [navigate]);

  const collapsedByWidth = vw < 1100;
  const showRail = !collapsedByWidth || manuallyOpen;

  useEffect(() => setManuallyOpen(false), [location.pathname]);

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

  return (
    <PageChromeProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-canvas">
        {showRail && (
          <div className={collapsedByWidth ? "fixed inset-y-0 left-0 z-30 shadow-[var(--shadow-drawer)]" : undefined}>
            <Sidebar onSearch={() => setCommandOpen(true)} />
          </div>
        )}
        {collapsedByWidth && manuallyOpen && (
          <div
            className="fixed inset-0 z-20 bg-[rgba(11,11,12,.28)]"
            onClick={() => setManuallyOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            pathname={location.pathname}
            showMenuBtn={collapsedByWidth}
            onToggleSidebar={() => setManuallyOpen((v) => !v)}
            onSearch={() => setCommandOpen(true)}
            onToggleNotifications={() => setNotifOpen((v) => !v)}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <RouteErrorBoundary>
              <Suspense fallback={<div className="pt-4"><RowsSkeleton /></div>}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} search={search} />
        <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      </div>
    </PageChromeProvider>
  );
}
