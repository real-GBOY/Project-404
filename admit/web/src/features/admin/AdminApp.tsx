import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Logo } from "@/components/Logo";
import { ChangePasswordDialog } from "@/components/PasswordDialogs";
import { fmtShortDate, fmtTime } from "@/lib/format";
import { AuthProvider, isDoorOnly, useAuth } from "./auth";
import { LoginPage } from "./LoginPage";
import { OverviewPage } from "./OverviewPage";
import { ReviewPage } from "./ReviewPage";
import { BookingsPage } from "./BookingsPage";
import { EventsAdminPage } from "./EventsAdminPage";
import { TicketsPage } from "./TicketsPage";
import { CheckinPage } from "./CheckinPage";
import { CustomersPage } from "./CustomersPage";
import { ReportsPage } from "./ReportsPage";
import { EmailPage } from "./EmailPage";
import { SettingsPage } from "./SettingsPage";
import { AuditPage } from "./AuditPage";

const EventEditorPage = lazy(() => import("./EventEditorPage"));

interface NavItem {
  to: string;
  label: string;
  /** Needed to see the entry at all; the server enforces the same on every route. */
  needs: string;
  badge?: "review" | "email";
}

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", needs: "read:event" },
  { to: "/admin/review", label: "Payment review", needs: "read:payment", badge: "review" },
  { to: "/admin/bookings", label: "Bookings", needs: "read:booking" },
  { to: "/admin/events", label: "Events", needs: "read:event" },
  { to: "/admin/tickets", label: "Tickets", needs: "read:ticket" },
  { to: "/admin/checkin", label: "Check-in", needs: "read:checkin" },
  { to: "/admin/customers", label: "Customers", needs: "read:booking" },
  { to: "/admin/email", label: "Email delivery", needs: "read:email", badge: "email" },
  { to: "/admin/reports", label: "Reports", needs: "read:report" },
  { to: "/admin/audit", label: "Audit log", needs: "read:audit_log" },
  { to: "/admin/settings", label: "Settings", needs: "manage:event_staff" },
];

function Shell() {
  const { me, can, logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const items = NAV.filter((n) => can(n.needs));
  const current = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => (n.to === "/admin" ? pathname === "/admin" : pathname.startsWith(n.to)));
  // the phone menu closes when you go somewhere, on Escape, and never leaves the page behind it scrollable
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);
  const queue = useQuery({
    queryKey: ["admin", "queue-count"],
    queryFn: () => adminApi.payments.queue(),
    enabled: can("read:payment"),
    refetchInterval: 20_000,
  });
  const mail = useQuery({
    queryKey: ["admin", "email-failed"],
    queryFn: () => adminApi.emails.list({ status: "FAILED", limit: 1 }),
    enabled: can("read:email"),
    refetchInterval: 60_000,
  });
  const count = (b?: NavItem["badge"]) =>
    (b === "review" ? queue.data?.length : b === "email" ? mail.data?.failedCount : 0) ?? 0;
  const now = new Date();
  return (
    <div className="flex min-h-screen">
      {navOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-ink/50 md:hidden"
        />
      ) : null}
      <aside
        id="admin-menu"
        aria-label="Menu"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[272px] max-w-[85vw] flex-none flex-col bg-night text-rule-strong transition-[transform,visibility] duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-[232px] md:max-w-none md:translate-x-0 md:visible ${navOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}
      >
        <div className="flex flex-col gap-3 border-b border-[#2e2a24] px-5 pb-4 pt-5">
          <span className="flex items-center gap-2">
            <Logo size={22} light />
            <span className="ml-1 font-mono text-[10px] text-faint">ORGANIZER</span>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="ml-auto grid size-9 place-items-center rounded-sm border border-night-rule bg-transparent text-lg leading-none text-paper md:hidden"
            >
              ×
            </button>
          </span>
          <span className="truncate rounded-sm border border-night-rule bg-night-2 px-2 py-2 text-[13px] text-paper">
            {me?.organizer.name}
          </span>
        </div>
        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
          {can("scan:checkin") ? (
            <a
              href="/scan"
              className="mb-1 flex h-[38px] items-center justify-between gap-2 rounded-[5px] border border-night-rule px-2.5 text-sm font-semibold text-paper no-underline hover:bg-night-2"
            >
              <span>Door scanner</span>
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/admin"}
              className={({ isActive }) =>
                `flex h-[38px] items-center justify-between gap-2 rounded-[5px] px-2.5 text-sm font-medium no-underline ${isActive ? "bg-paper text-ink hover:text-ink" : "text-rule-strong hover:bg-night-2 hover:text-paper"}`
              }
            >
              <span>{n.label}</span>
              {count(n.badge) > 0 ? (
                <span
                  aria-label={`${count(n.badge)} need attention`}
                  className={`rounded-full px-1.5 py-px font-mono text-[11px] text-white ${n.badge === "email" ? "bg-bad-solid" : "bg-pending-fg"}`}
                >
                  {count(n.badge)}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-[#2e2a24] px-5 py-3.5 text-[13px]">
          <span className="font-semibold text-paper">{me?.user.name}</span>
          <span className="text-faint">
            {me?.eventReach === "all" ? "All events" : "Assigned events"}
          </span>
          <button
            onClick={() => {
              setNavOpen(false);
              setPwOpen(true);
            }}
            className="mt-1.5 self-start bg-transparent p-0 text-xs text-faint underline hover:text-paper"
          >
            Change password
          </button>
          <button
            onClick={() => logout()}
            className="self-start bg-transparent p-0 text-xs text-faint underline hover:text-paper"
          >
            Sign out
          </button>
          {me ? (
            <a href={`/e/${me.organizer.slug}`} className="text-xs text-faint">
              Customer site ↗
            </a>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[60px] items-center gap-4 border-b border-rule-strong bg-paper px-4 md:px-7">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-controls="admin-menu"
            aria-expanded={navOpen}
            className="grid size-10 flex-none place-items-center rounded-sm border border-rule-strong bg-transparent md:hidden"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
              <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <div className="md:hidden">
            <Logo size={20} />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">
            {current?.label}
          </span>
          <span className="hidden flex-1 md:block" />
          <span className="hidden whitespace-nowrap font-mono text-xs text-ink-2 sm:inline">
            {fmtShortDate(now)} · {fmtTime(now)}
          </span>
        </header>
        <main className="flex w-full max-w-[1520px] flex-col gap-6 px-4 pb-16 pt-6 md:px-7">
          <Outlet />
        </main>
      </div>
      <ChangePasswordDialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onChanged={() => logout("password_changed")}
      />
    </div>
  );
}

/** The dashboard home. A door person has no dashboard to work in, so they go straight to the scanner. */
function Home() {
  const { can } = useAuth();
  if (isDoorOnly(can)) return <Navigate to="/scan" replace />;
  return <OverviewPage />;
}

function RequireAuth() {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === "loading")
    return (
      <p role="status" aria-busy="true" className="p-8 text-sm text-ink-2">
        Loading…
      </p>
    );
  if (status === "unauthenticated")
    return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  return <Shell />;
}

/** A page the signed-in person is not allowed to see: named plainly, never rendered as disabled controls. */
export function Forbidden({ needs }: { needs: string }) {
  return (
    <div
      role="alert"
      className="flex max-w-lg flex-col gap-2 border border-rule-strong bg-surface p-6"
    >
      <h1 className="display text-4xl">You do not have access</h1>
      <p className="text-sm text-ink-2">
        This page needs the <span className="font-mono">{needs}</span> permission. Ask an owner of
        your organizer to change your role.
      </p>
    </div>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <p role="status" className="p-8 text-sm text-ink-2">
            Loading…
          </p>
        }
      >
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route index element={<Home />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="events" element={<EventsAdminPage />} />
            <Route path="events/new" element={<EventEditorPage />} />
            <Route path="events/:id" element={<EventEditorPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="email" element={<EmailPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
