import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDeskDay, type DeskReservation } from "@/api/front-desk";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ToneBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp, formatIsoDate, formatLongDate } from "@/lib/format";
import { CheckInDialog } from "./check-in-dialog";
import { CheckOutDialog } from "./check-out-dialog";

function PayBadge({ r }: { r: DeskReservation }) {
  if (r.folio.balance <= 0) return <ToneBadge tone="success">Paid</ToneBadge>;
  if (r.folio.paid > 0)
    return <ToneBadge tone="warning">{`Due ${formatEgp(r.folio.balance)}`}</ToneBadge>;
  return <ToneBadge tone="warning">Balance due</ToneBadge>;
}

/**
 * Front desk (design: "Front Desk"): today's arrivals and departures as action cards, and who is
 * in house. Check-in and check-out open the workflow dialogs; the server does the work.
 */
export function FrontDeskPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const day = useDeskDay();
  const [checkingIn, setCheckingIn] = useState<DeskReservation | null>(null);
  const [checkingOut, setCheckingOut] = useState<DeskReservation | null>(null);

  const quickActions = [
    auth.can("create:reservation") && { label: "+ New Reservation", to: "/reservations/new" },
    auth.can("read:guest") && { label: "Guest lookup", to: "/guests" },
    auth.can("read:reservation") && { label: "Booking calendar", to: "/calendar" },
    auth.can("read:room") && { label: "Room board", to: "/rooms" },
  ].filter(Boolean) as Array<{ label: string; to: string }>;

  return (
    <>
      <PageHeader
        title="Front Desk"
        subtitle={
          day.data
            ? `${formatLongDate(new Date(`${day.data.date}T12:00:00Z`))} · fast check-ins, check-outs and guest lookups.`
            : "Fast check-ins, check-outs and guest lookups."
        }
      />
      <div className="mb-[22px] flex flex-wrap gap-2.5">
        {quickActions.map((a) => (
          <Button key={a.to} variant="secondary" size="sm" onClick={() => navigate(a.to)}>
            {a.label}
          </Button>
        ))}
      </div>

      {day.isLoading ? (
        <LoadingState />
      ) : day.error ? (
        <ErrorState error={day.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="m-0 mb-3.5 text-title font-bold">
                Today's Arrivals · {day.data!.arrivals.length}
              </h2>
              {day.data!.arrivals.length === 0 ? (
                <EmptyState title="No arrivals left today." />
              ) : (
                <ul className="m-0 list-none p-0">
                  {day.data!.arrivals.map((r) => (
                    <DeskCard
                      key={r.id}
                      r={r}
                      subtitle={
                        r.arrival < day.data!.date
                          ? `Due ${formatIsoDate(r.arrival)} — still expected`
                          : r.room && !r.room.ready
                            ? `Room ${r.roomNumber} not ready (${r.room.housekeepingStatus})`
                            : undefined
                      }
                      primary={
                        auth.can("check_in:reservation") && r.status === "confirmed"
                          ? { label: "Check In", onClick: () => setCheckingIn(r) }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="m-0 mb-3.5 text-title font-bold">
                Today's Departures · {day.data!.departures.length}
              </h2>
              {day.data!.departures.length === 0 ? (
                <EmptyState title="No departures left today." />
              ) : (
                <ul className="m-0 list-none p-0">
                  {day.data!.departures.map((r) => (
                    <DeskCard
                      key={r.id}
                      r={r}
                      subtitle={
                        r.departure < day.data!.date
                          ? `Was due out ${formatIsoDate(r.departure)}`
                          : undefined
                      }
                      primary={
                        auth.can("check_out:reservation")
                          ? { label: "Check Out", onClick: () => setCheckingOut(r) }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="m-0 mb-3 text-title font-bold">In House · {day.data!.inHouse.length}</h2>
            {day.data!.inHouse.length === 0 ? (
              <EmptyState title="No guests in house." />
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-x-6 p-0 md:grid-cols-2 xl:grid-cols-3">
                {day.data!.inHouse.map((r) => (
                  <li key={r.id} className="border-b border-divider">
                    <Link
                      to={`/reservations/${r.id}`}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-small font-semibold">{r.guestName}</div>
                        <div className="text-label text-faint">
                          Room {r.roomNumber} · until {formatIsoDate(r.departure)}
                        </div>
                      </div>
                      <PayBadge r={r} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {checkingIn ? (
        <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} />
      ) : null}
      {checkingOut ? (
        <CheckOutDialog reservation={checkingOut} onClose={() => setCheckingOut(null)} />
      ) : null}
    </>
  );
}

function DeskCard({
  r,
  subtitle,
  primary,
}: {
  r: DeskReservation;
  subtitle?: string;
  primary?: { label: string; onClick: () => void };
}) {
  return (
    <li className="mb-2.5 rounded-inner border border-border-subtle p-3.5 last:mb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-body font-bold">{r.guestName}</div>
          <div className="mt-0.5 text-label text-muted">
            Room {r.roomNumber ?? "—"} · {r.roomTypeName}
          </div>
          {subtitle ? (
            <div className="mt-1 text-label font-semibold text-warning-strong">{subtitle}</div>
          ) : null}
        </div>
        <PayBadge r={r} />
      </div>
      <div className="mt-3 flex gap-2">
        {primary ? (
          <Button size="sm" className="flex-1 !py-2 text-label" onClick={primary.onClick}>
            {primary.label}
          </Button>
        ) : null}
        <Link
          to={`/reservations/${r.id}`}
          className="flex-1 rounded-control border border-border bg-surface py-2 text-center text-label font-bold hover:bg-canvas"
        >
          View
        </Link>
      </div>
    </li>
  );
}
