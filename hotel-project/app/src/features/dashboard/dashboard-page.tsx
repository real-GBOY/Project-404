import { Link, useNavigate } from "react-router-dom";
import { useDashboard, useHousekeepingTasks, useTickets, type Dashboard } from "@/api/operations";
import { useDeskDay, type DeskReservation } from "@/api/front-desk";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  firstName,
  formatDayHeader,
  formatEgp,
  formatLongDate,
  formatStay,
  greeting,
} from "@/lib/format";
import { cn } from "@/lib/cn";

const ROOM_STATUS_ORDER = [
  "available",
  "reserved",
  "occupied",
  "dirty",
  "cleaning",
  "maintenance",
  "out_of_service",
] as const;

const ROOM_TILE: Record<(typeof ROOM_STATUS_ORDER)[number], string> = {
  available: "bg-success-soft text-success",
  reserved: "bg-warning-soft text-warning",
  occupied: "bg-primary-soft text-primary",
  dirty: "bg-danger-soft text-danger",
  cleaning: "bg-info-soft text-info",
  maintenance: "bg-danger-soft text-danger",
  out_of_service: "bg-neutral-soft text-neutral",
};

const ALERT_DOT: Record<Dashboard["alerts"][number]["type"], string> = {
  maintenance: "bg-danger",
  finance: "bg-warning",
  housekeeping: "bg-info",
  guest: "bg-primary",
};

/**
 * Dashboard — "What is happening in the hotel today?". Everything is computed server-side from
 * the ledgers (`GET /hotel/dashboard`). Roles without `read:dashboard` (housekeeping,
 * maintenance) get the same header and a short "your work" panel instead of hotel-wide figures.
 */
export function DashboardPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const canSee = auth.can("read:dashboard");
  const dash = useDashboard(canSee);
  const desk = useDeskDay(canSee && auth.can("read:reservation"));
  const now = new Date();

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-display font-extrabold tracking-[-0.01em]">
            {greeting(now)}, {firstName(auth.user?.displayName)}
          </h1>
          <p className="m-0 mt-[3px] text-body text-muted">{formatLongDate(now)}</p>
        </div>
        {auth.can("create:reservation") ? (
          <Button onClick={() => navigate("/reservations/new")}>+ New Reservation</Button>
        ) : null}
      </div>

      {!canSee ? (
        <MyWork />
      ) : dash.isLoading ? (
        <LoadingState />
      ) : dash.error ? (
        <ErrorState error={dash.error} />
      ) : (
        <Overview d={dash.data!} desk={desk.data} />
      )}
    </>
  );
}

function Overview({
  d,
  desk,
}: {
  d: Dashboard;
  desk: { arrivals: DeskReservation[]; departures: DeskReservation[] } | undefined;
}) {
  const k = d.kpis;
  const signed = (n: number) => `${n > 0 ? "↑" : n < 0 ? "↓" : "→"} ${Math.abs(n)}%`;
  const kpis = [
    {
      label: "Occupancy",
      value: `${k.occupancyPct}%`,
      sub: `${signed(k.occupancyDelta)} vs yesterday`,
      tone: k.occupancyDelta >= 0 ? "text-success" : "text-danger",
    },
    {
      label: "Today's Revenue",
      value: formatEgp(Math.round(k.revenueToday)),
      exact: formatEgp(k.revenueToday),
      sub:
        k.revenueDelta === null ? "Room revenue tonight" : `${signed(k.revenueDelta)} vs yesterday`,
      tone: (k.revenueDelta ?? 0) >= 0 ? "text-success" : "text-danger",
    },
    {
      label: "Arrivals",
      value: String(k.arrivals.total),
      sub: `${k.arrivals.pending} pending check-in`,
      tone: k.arrivals.pending > 0 ? "text-warning" : "text-muted",
    },
    {
      label: "Departures",
      value: String(k.departures.total),
      sub: `${k.departures.pending} pending checkout`,
      tone: k.departures.pending > 0 ? "text-warning" : "text-muted",
    },
    {
      label: "Available Rooms",
      value: String(k.availableRooms),
      sub: `of ${k.totalRooms} total`,
      tone: "text-muted",
    },
    {
      label: "Outstanding",
      value: formatEgp(Math.round(k.outstanding)),
      exact: formatEgp(k.outstanding),
      sub: "Unpaid on open folios",
      tone: k.outstanding > 0 ? "text-danger" : "text-muted",
    },
  ];
  const today = d.trend.at(-1);

  return (
    <>
      <div className="mb-[26px] grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((c) => (
          <div
            key={c.label}
            aria-label={c.label}
            className="rounded-card border border-border bg-surface p-4"
          >
            <div className="mb-2 text-label font-semibold text-muted">{c.label}</div>
            <div
              className="text-[22px] font-extrabold tracking-[-0.01em]"
              title={"exact" in c ? c.exact : undefined}
            >
              {c.value}
            </div>
            <div className={cn("mt-[5px] text-label font-semibold", c.tone)}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <h2 className="m-0 mb-3.5 text-title font-bold">Today's Operations</h2>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <MovementList title="Arrivals" items={desk?.arrivals} />
            <MovementList title="Departures" items={desk?.departures} />
          </div>
        </Card>
        <Card>
          <h2 className="m-0 mb-3.5 text-title font-bold">Operational Alerts</h2>
          {d.alerts.length === 0 ? (
            <p className="m-0 text-small text-muted">Nothing needs attention.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {d.alerts.map((a, i) => (
                <li key={i} className="border-b border-divider last:border-b-0">
                  <AlertRow alert={a} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChart
          title="Revenue — last 7 days"
          headline={`${formatEgp(today?.revenue ?? 0)} today`}
          headlineTone="text-success"
          points={d.trend.map((p) => ({
            date: p.date,
            value: p.revenue,
            label: formatEgp(p.revenue),
          }))}
          barToday="bg-primary"
          barPast="bg-chart-muted"
        />
        <BarChart
          title="Occupancy — last 7 days"
          headline={`${today?.occupancyPct ?? 0}% today`}
          headlineTone="text-primary-strong"
          points={d.trend.map((p) => ({
            date: p.date,
            value: p.occupancyPct,
            label: `${p.occupancyPct}%`,
          }))}
          barToday="bg-success"
          barPast="bg-chart-success-muted"
        />
      </div>

      <Card className="mb-4">
        <h2 className="m-0 mb-3.5 text-title font-bold">Room Status</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {ROOM_STATUS_ORDER.map((s) => (
            <Link
              key={s}
              to="/rooms"
              aria-label={`${d.roomStatus[s] ?? 0} ${s.replace(/_/g, " ")}`}
              className={cn("rounded-[10px] p-3", ROOM_TILE[s])}
            >
              <div className="text-[20px] font-extrabold">{d.roomStatus[s] ?? 0}</div>
              <div className="text-label font-semibold capitalize">{s.replace(/_/g, " ")}</div>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-title font-bold">Recent Reservations</h2>
          <Link to="/reservations" className="text-small font-semibold text-primary">
            View all →
          </Link>
        </div>
        <div className="hidden grid-cols-[100px_1.3fr_80px_1fr_110px_110px] border-b border-border-subtle py-2 text-micro font-bold tracking-[0.03em] text-faint uppercase md:grid">
          <div>Booking</div>
          <div>Guest</div>
          <div>Room</div>
          <div>Dates</div>
          <div>Amount</div>
          <div>Status</div>
        </div>
        <ul className="m-0 list-none p-0">
          {d.recentReservations.map((r) => (
            <li key={r.id} className="border-b border-divider last:border-b-0">
              <Link
                to={`/reservations/${r.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-[11px] md:grid-cols-[100px_1.3fr_80px_1fr_110px_110px]"
              >
                <div className="font-mono text-label text-muted">{r.code}</div>
                <div className="text-small font-semibold max-md:order-first">{r.guestName}</div>
                <div className="text-small max-md:hidden">{r.roomNumber ?? "—"}</div>
                <div className="text-label text-muted">{formatStay(r.arrival, r.departure)}</div>
                <div className="text-small font-semibold max-md:hidden">{formatEgp(r.total)}</div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function MovementList({ title, items }: { title: string; items: DeskReservation[] | undefined }) {
  return (
    <div>
      <div className="mb-2 text-label font-bold tracking-[0.04em] text-muted uppercase">
        {title}
      </div>
      {!items ? null : items.length === 0 ? (
        <p className="m-0 py-2 text-small text-faint">None left today.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {items.slice(0, 4).map((r) => (
            <li key={r.id} className="border-b border-divider">
              <Link
                to={`/reservations/${r.id}`}
                className="flex items-center justify-between gap-2 py-[9px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-small font-bold">{r.guestName}</div>
                  <div className="text-label text-faint">Room {r.roomNumber ?? "—"}</div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
          {items.length > 4 ? (
            <li className="pt-2">
              <Link to="/front-desk" className="text-label font-semibold text-primary">
                +{items.length - 4} more at the front desk →
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Dashboard["alerts"][number] }) {
  const body = (
    <>
      <span className={cn("mt-1.5 size-[7px] shrink-0 rounded-full", ALERT_DOT[alert.type])} />
      <span className="text-small leading-[1.45]">{alert.text}</span>
    </>
  );
  return alert.href ? (
    <Link to={alert.href} className="flex items-start gap-2.5 py-[9px] hover:text-primary">
      {body}
    </Link>
  ) : (
    <div className="flex items-start gap-2.5 py-[9px]">{body}</div>
  );
}

function BarChart({
  title,
  headline,
  headlineTone,
  points,
  barToday,
  barPast,
}: {
  title: string;
  headline: string;
  headlineTone: string;
  points: Array<{ date: string; value: number; label: string }>;
  barToday: string;
  barPast: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-title font-bold">{title}</h2>
        <div className={cn("text-small font-bold", headlineTone)}>{headline}</div>
      </div>
      <div className="flex h-[100px] items-end gap-2.5" role="list" aria-label={title}>
        {points.map((p, i) => (
          <div
            key={p.date}
            role="listitem"
            aria-label={`${p.date}: ${p.label}`}
            title={`${formatDayHeader(p.date)} · ${p.label}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <div
              className={cn("w-full rounded-t-[5px]", i === points.length - 1 ? barToday : barPast)}
              style={{
                height: `${Math.max(Math.round((p.value / max) * 80), p.value > 0 ? 3 : 0)}px`,
              }}
            />
            <div className="text-micro text-faint">{formatDayHeader(p.date).slice(0, 1)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** For staff without hotel-wide figures: their own queue, one tap away. */
function MyWork() {
  const auth = useAuth();
  const hk = auth.can("read:housekeeping") && auth.can("update:housekeeping");
  const mt = auth.can("read:maintenance") && auth.can("update:maintenance");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {hk ? <HousekeepingSummary /> : null}
      {mt ? <MaintenanceSummary /> : null}
      {!hk && !mt ? (
        <Card>
          <p className="m-0 text-small text-muted">Use the menu to get to your work.</p>
        </Card>
      ) : null}
    </div>
  );
}

function HousekeepingSummary() {
  const tasks = useHousekeepingTasks({ mine: true });
  const open = (tasks.data ?? []).filter((t) =>
    ["pending", "assigned", "in_progress"].includes(t.status),
  );
  return (
    <Card>
      <h2 className="m-0 mb-3.5 text-title font-bold">Your rooms today</h2>
      <div className="text-[28px] font-extrabold">{tasks.isLoading ? "…" : open.length}</div>
      <p className="m-0 mb-3 text-small text-muted">rooms waiting on you</p>
      <Link to="/housekeeping" className="text-small font-semibold text-primary">
        Open the housekeeping board →
      </Link>
    </Card>
  );
}

function MaintenanceSummary() {
  const tickets = useTickets({ mine: true });
  const open = (tickets.data ?? []).filter((t) => !["resolved", "verified"].includes(t.status));
  return (
    <Card>
      <h2 className="m-0 mb-3.5 text-title font-bold">Your tickets</h2>
      <div className="text-[28px] font-extrabold">{tickets.isLoading ? "…" : open.length}</div>
      <p className="m-0 mb-3 text-small text-muted">open tickets assigned to you</p>
      <Link to="/maintenance" className="text-small font-semibold text-primary">
        Open maintenance →
      </Link>
    </Card>
  );
}
