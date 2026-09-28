import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkRead, useNotifications, type AppNotification } from "@/api/workspace";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";

const CATEGORY: Array<{ prefix: string; label: string; dot: string }> = [
  { prefix: "hotel.maintenance", label: "Maintenance", dot: "bg-danger" },
  { prefix: "hotel.housekeeping", label: "Housekeeping", dot: "bg-info" },
  { prefix: "hotel.money", label: "Finance", dot: "bg-warning" },
  { prefix: "hotel.reservation", label: "Front desk", dot: "bg-primary" },
];

function category(n: AppNotification) {
  return (
    CATEGORY.find((c) => n.type.startsWith(c.prefix)) ?? {
      label: "HotelOS",
      dot: "bg-neutral",
    }
  );
}

/**
 * The design's topbar bell: a red dot while anything is unread, and a 340px panel of recent
 * notifications (Core's in-app inbox, polled every minute). Opening one marks it read and goes to
 * the record it's about.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const inbox = useNotifications(true);
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const unread = inbox.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !panel.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const openOne = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.data?.href) navigate(n.data.href);
  };

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-button border border-border bg-canvas hover:bg-surface"
      >
        <span
          aria-hidden="true"
          className="size-4 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] border-2 border-neutral"
        />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-[7px] size-2 rounded-full border-[1.5px] border-surface bg-danger" />
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-11 right-0 z-50 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-card border border-border bg-surface shadow-popover"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
            <span className="text-small font-bold">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markRead.mutate("all")}
                className="cursor-pointer text-label font-semibold text-primary hover:text-primary-strong"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {(inbox.data?.notifications ?? []).length === 0 ? (
            <p className="m-0 px-4 py-8 text-center text-small text-faint">You're all caught up.</p>
          ) : (
            <ul className="m-0 max-h-[420px] list-none overflow-y-auto p-0">
              {inbox.data!.notifications.map((n) => {
                const c = category(n);
                return (
                  <li key={n.id} className="border-b border-divider last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openOne(n)}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-2.5 px-4 py-3 text-left hover:bg-canvas",
                        n.read && "opacity-70",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-[7px] shrink-0 rounded-full",
                          n.read ? "bg-rule" : c.dot,
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-small leading-[1.4] font-semibold">
                          {n.title}
                        </span>
                        {n.body ? (
                          <span className="block text-label text-muted">{n.body}</span>
                        ) : null}
                        <span className="mt-0.5 block text-micro text-faint">
                          {formatRelative(n.createdAt)} · {c.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
