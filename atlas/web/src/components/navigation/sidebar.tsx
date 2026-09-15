import { useCallback, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { NAV } from "@/app/router/nav";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/auth-provider";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/ui/logo";

const OPEN_KEY = "atlas.sidebar.groups";

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(readOpen);
  const auth = useAuth();
  const navigate = useNavigate();
  const displayName = auth.user?.displayName ?? auth.user?.email ?? "Signed in";

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

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <aside className="flex h-dvh w-sidebar flex-none flex-col border-r border-border-sidebar bg-sidebar">
      <div className="flex items-center gap-2 border-b border-border-sidebar px-4 pb-3.5 pt-4">
        <LogoMark size={26} tone="paper" />
        <div className="min-w-0">
          <div className="text-[12px] font-bold leading-none tracking-[-0.02em] text-sidebar-foreground">ATLAS</div>
          <div className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.16em] text-muted">
            Real Estate OS
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-1 pt-2.5">
        <button
          type="button"
          onClick={onSearch}
          className="flex w-full items-center gap-2 border border-border-sidebar bg-surface-sidebar-subtle px-2 py-1.5 text-start font-mono text-[11px] text-muted transition-colors hover:border-secondary hover:text-sidebar-foreground"
        >
          <Icon name="search" size={13} />
          <span className="flex-1">Search everything</span>
          <span className="border border-border-sidebar px-1 font-mono text-[9px]">⌘K</span>
        </button>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-1.5 pb-4">
        {NAV.map((group) => {
          const expanded = open[group.title] !== false;
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => toggle(group.title)}
                aria-expanded={expanded}
                className="flex w-full select-none items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted transition-colors hover:bg-surface-nav-hover hover:text-sidebar-foreground"
              >
                <span className="flex-1 text-start">{group.title}</span>
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={10} />
              </button>
              {expanded &&
                group.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-2 border-l-[3px] px-2.5 py-[9px] text-[11.5px] transition-colors",
                        active
                          ? "border-primary bg-surface-nav-hover font-semibold text-white"
                          : "border-transparent text-sidebar-foreground hover:bg-surface-nav-hover hover:text-white",
                      )}
                    >
                      <Icon name={item.icon} size={14} className={active ? "text-primary" : "text-muted"} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && (
                        <span className="bg-surface-sidebar-subtle px-1 font-mono text-[9px] font-semibold text-danger-secondary">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-border-sidebar bg-surface-sidebar-subtle px-3 py-2.5">
        <Avatar name={displayName} variant="brand" size={24} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-sidebar-foreground">{displayName}</div>
          <div className="truncate text-[9.5px] text-muted">{auth.user?.email}</div>
        </div>
        <button
          type="button"
          title="Sign out"
          className="text-muted hover:text-sidebar-foreground"
          onClick={() => {
            auth.logout();
            navigate("/login", { replace: true });
          }}
        >
          <Icon name="logout" size={14} />
        </button>
      </div>
    </aside>
  );
}
