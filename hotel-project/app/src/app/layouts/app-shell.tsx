import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PUBLIC_SITE_URL } from "@/config";
import { useAuth } from "@/features/auth/use-auth";
import { useMyRole } from "@/api/staff";
import { Brand } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { NAV_GROUPS, visibleNav } from "../nav";

/**
 * The HotelOS application frame from the design: a 232px surface sidebar with grouped
 * navigation (dot + label, primary-soft active state), a topbar, and a scrolling canvas content
 * area (28px 32px padding). Below `lg` the sidebar becomes a drawer — reception tablets and
 * housekeeping/maintenance phones get the same navigation without a squeezed desktop layout.
 */
export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = visibleNav(NAV_GROUPS, auth.can);
  const role = useMyRole(auth.status === "authenticated");

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas text-ink">
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-shadow lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3.5 py-5 transition-transform lg:static lg:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-2 pt-1 pb-[22px]">
          <Brand />
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.label} className="mb-[18px]">
              <div className="px-2.5 pb-1.5 text-micro font-bold tracking-[0.05em] text-faint uppercase">
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-control px-2.5 py-[9px] text-body font-semibold",
                      isActive ? "bg-primary-soft text-primary" : "text-ink-nav hover:bg-canvas",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          isActive ? "bg-primary" : "bg-rule",
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex-1" />
        <a
          href={PUBLIC_SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 border-t border-border-subtle px-2.5 py-[9px] text-small font-semibold text-muted hover:text-ink"
        >
          ↗ View public website
        </a>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-4 py-3.5 sm:px-7">
          <button
            type="button"
            className="flex size-9 cursor-pointer items-center justify-center rounded-button border border-border bg-canvas lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true" className="flex w-4 flex-col gap-[3px]">
              <span className="h-0.5 rounded bg-ink-nav" />
              <span className="h-0.5 rounded bg-ink-nav" />
              <span className="h-0.5 rounded bg-ink-nav" />
            </span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-[9px] rounded-button px-2 py-1">
            <div
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-small font-bold text-primary-strong"
            >
              {initials(auth.user?.displayName)}
            </div>
            <div className="hidden sm:block">
              <div className="text-small leading-tight font-bold">{auth.user?.displayName}</div>
              <div className="text-micro leading-tight text-faint">
                {role.data?.roleName ?? auth.user?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={auth.logout}
            className="cursor-pointer rounded-control px-2 py-1 text-small font-semibold text-muted hover:text-ink"
          >
            Sign out
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-7 pb-15 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
