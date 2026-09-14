import { useNavigate } from "react-router-dom";
import { GROUP_OF, DETAIL_TITLES, NAV_ITEMS } from "@/app/router/nav";
import { useReadPageChrome } from "@/lib/page-chrome";
import { useOnlineCount } from "@/lib/realtime/online-count";
import { useNotifications } from "@/lib/notifications/notifications-provider";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";

export function TopBar({
  pathname,
  showMenuBtn,
  onToggleSidebar,
  onSearch,
  onToggleNotifications,
}: {
  pathname: string;
  showMenuBtn: boolean;
  onToggleSidebar: () => void;
  onSearch: () => void;
  onToggleNotifications: () => void;
}) {
  const navigate = useNavigate();
  const chrome = useReadPageChrome();
  const online = useOnlineCount();
  const { unreadCount } = useNotifications();

  const fallback = NAV_ITEMS.filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];

  const group = chrome.group ?? (fallback ? GROUP_OF[fallback.to] : "Overview");
  const title =
    chrome.title ??
    fallback?.label ??
    DETAIL_TITLES[pathname.split("/")[1] ?? ""] ??
    "Dashboard";

  return (
    <header className="flex h-topbar flex-none items-center gap-3.5 border-b border-border bg-surface px-4">
      {showMenuBtn && <IconButton icon="menu" aria-label="Toggle sidebar" onClick={onToggleSidebar} />}

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.1em] text-subtle">{group}</span>
        <span className="text-faint">/</span>
        <span className="truncate text-[13px] font-semibold">{title}</span>
      </div>

      <div className="flex-1" />

      <div className="hidden items-center gap-1.5 rounded-btn border border-border px-2 py-1 text-[10.5px] text-body md:flex">
        <span className="size-1.5 rounded-full bg-success" style={{ animation: "pulsedot 2.2s infinite" }} />
        <span>
          Live · {online} online
        </span>
      </div>

      <Button variant="secondary" size="sm" icon="search" onClick={onSearch} className="hidden sm:inline-flex">
        Search <span className="font-mono text-[9px] text-subtle">⌘K</span>
      </Button>

      <div className="relative">
        <IconButton icon="bell" aria-label="Notifications" onClick={onToggleNotifications} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 font-mono text-[9px] text-white">
            {unreadCount}
          </span>
        )}
      </div>

      <Button variant="dark" size="sm" icon="spark" onClick={() => navigate("/copilot")}>
        Copilot
      </Button>
    </header>
  );
}
