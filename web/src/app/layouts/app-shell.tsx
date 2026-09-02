import { Outlet } from "react-router-dom";
import { Icon } from "@/components/ui/icon";

/**
 * Application shell — sidebar + top bar + content region.
 *
 * F0: a minimal frame so routed pages render. The real permission-aware sidebar,
 * top bar (search / ⌘K / Ask Mizan / notifications / org switcher), and
 * breadcrumb land in F2.
 */
export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 flex h-dvh w-sidebar flex-none flex-col border-e border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-divider px-4 py-4">
          <div className="flex size-8 flex-none items-center justify-center rounded-[11px] bg-primary text-[15px] font-extrabold text-primary-foreground">
            M
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold tracking-tight">Mizan</div>
            <div className="text-[11px] font-medium text-muted">Tawfik &amp; Partners</div>
          </div>
        </div>
        <nav className="flex-1 p-3 text-[13px] text-muted">
          <div className="flex items-center gap-2 px-2 py-2">
            <Icon name="dashboard" size={18} />
            <span>Navigation — F2</span>
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-topbar flex-none items-center border-b border-border bg-surface px-6">
          <span className="text-[15px] font-extrabold tracking-tight">Mizan</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
