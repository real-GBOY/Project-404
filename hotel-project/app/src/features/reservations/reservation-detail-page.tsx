import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  SOURCE_LABEL,
  useReservation,
  useReservationAction,
  type ReservationDetail,
} from "@/api/reservations";
import { useAuth } from "@/features/auth/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatEgp, formatIsoDate, formatRelative, formatStay, hotelToday } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import {
  CancelDialog,
  ChangeDatesDialog,
  ChangeRoomDialog,
  ExtendStayDialog,
} from "./reservation-dialogs";
import { CheckInDialog } from "@/features/front-desk/check-in-dialog";
import { CheckOutDialog } from "@/features/front-desk/check-out-dialog";
import { FolioCard } from "@/features/billing/folio-card";

/**
 * Reservation detail (design: "Reservation detail"). Actions are offered only when the server's
 * state machine allows them (`commands`) AND the user holds the permission — the backend still
 * enforces both.
 */
export function ReservationDetailPage() {
  const { reservationId = "" } = useParams();
  const reservation = useReservation(reservationId);
  if (reservation.isLoading) return <LoadingState />;
  if (reservation.error || !reservation.data) return <ErrorState error={reservation.error} />;
  return <Detail r={reservation.data} />;
}

function Detail({ r }: { r: ReservationDetail }) {
  const auth = useAuth();
  const action = useReservationAction(r.id);
  const toast = useToast();
  const [dialog, setDialog] = useState<
    "cancel" | "room" | "dates" | "check_in" | "check_out" | "extend" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const canUpdate = auth.can("update:reservation");
  const modifiable = canUpdate && (r.status === "pending" || r.status === "confirmed");

  async function run(kind: "confirm" | "no_show", done: string) {
    setError(null);
    try {
      await action.mutateAsync({ kind });
      toast(done);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: "/reservations", label: "Back to Reservations" }}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">#{r.code}</span>
            <StatusBadge status={r.status} className="rounded-[7px] px-2.5 py-1 text-label" />
          </span>
        }
        subtitle={`${formatStay(r.arrival, r.departure)} · ${r.nights} ${r.nights === 1 ? "night" : "nights"}`}
        actions={
          <>
            {auth.can("check_in:reservation") &&
            r.commands.includes("check_in") &&
            r.arrival <= hotelToday() ? (
              <Button size="sm" onClick={() => setDialog("check_in")}>
                Check In
              </Button>
            ) : null}
            {auth.can("check_out:reservation") && r.commands.includes("check_out") ? (
              <Button size="sm" onClick={() => setDialog("check_out")}>
                Check Out
              </Button>
            ) : null}
            {canUpdate && r.status === "checked_in" ? (
              <Button variant="secondary" size="sm" onClick={() => setDialog("extend")}>
                Extend stay
              </Button>
            ) : null}
            {canUpdate && r.commands.includes("confirm") ? (
              <Button
                size="sm"
                onClick={() => void run("confirm", `${r.code} confirmed`)}
                disabled={action.isPending}
              >
                Confirm
              </Button>
            ) : null}
            {/* The server also refuses a no-show before the arrival date. */}
            {canUpdate && r.commands.includes("no_show") && r.arrival <= hotelToday() ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void run("no_show", `${r.code} marked as no-show`)}
                disabled={action.isPending}
              >
                Mark no-show
              </Button>
            ) : null}
            {modifiable ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setDialog("room")}>
                  Change room
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDialog("dates")}>
                  Change dates
                </Button>
              </>
            ) : null}
            {auth.can("cancel:reservation") && r.commands.includes("cancel") ? (
              <Button variant="secondary" size="sm" onClick={() => setDialog("cancel")}>
                Cancel booking
              </Button>
            ) : null}
          </>
        }
      />
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-control bg-danger-soft px-3.5 py-2.5 text-small font-semibold text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Guest</CardTitle>
            <Link to={`/guests/${r.guestId}`} className="flex items-center gap-3">
              <Avatar name={r.guestName} />
              <div>
                <div className="text-body font-bold">{r.guestName}</div>
                <div className="text-label text-muted">
                  {r.adults + r.children} {r.adults + r.children === 1 ? "guest" : "guests"} · View
                  profile →
                </div>
              </div>
            </Link>
          </Card>

          <Card>
            <CardTitle>Stay</CardTitle>
            <dl className="m-0 grid grid-cols-2 gap-3.5 text-small">
              <Item label="Room" value={`${r.roomNumber ?? "—"} · ${r.roomTypeName}`} />
              <Item label="Source" value={SOURCE_LABEL[r.source]} />
              <Item label="Check-in" value={formatIsoDate(r.arrival, true)} />
              <Item label="Check-out" value={formatIsoDate(r.departure, true)} />
              <Item
                label="Guests"
                value={`${r.adults} adult${r.adults === 1 ? "" : "s"}${r.children ? ` · ${r.children} child${r.children === 1 ? "" : "ren"}` : ""}`}
              />
              {r.cancellationReason ? (
                <Item label="Cancellation reason" value={r.cancellationReason} />
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardTitle className="mb-2.5">Notes</CardTitle>
            <p className="m-0 text-small leading-normal text-ink-soft">{r.notes ?? "No notes."}</p>
          </Card>

          <Card>
            <CardTitle>Activity Timeline</CardTitle>
            <ol className="m-0 list-none p-0">
              {[...r.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3 pb-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-[5px] size-2 shrink-0 rounded-full bg-primary"
                  />
                  <div>
                    <div className="text-small font-semibold">
                      {h.fromStatus ? `${statusLabel(h.toStatus)}` : "Reservation created"}
                      {h.reason ? ` — ${h.reason}` : ""}
                    </div>
                    <div className="mt-0.5 text-label text-faint">
                      {h.actorName} · {formatRelative(h.at)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4 self-start">
          <FolioCard reservation={r} />
          <Card>
            <CardTitle>Price</CardTitle>
            <ul className="m-0 mb-2 list-none p-0">
              {r.nightlyRates.map((n) => (
                <li key={n.date} className="flex justify-between py-1 text-small">
                  <span className="text-muted">
                    {formatIsoDate(n.date)}
                    {n.rule ? (
                      <span className="ml-1.5 text-label text-faint">· {n.rule}</span>
                    ) : null}
                  </span>
                  <span className="font-semibold">{formatEgp(n.rate)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-border-subtle pt-2.5 text-small">
              <span className="text-muted">Room total</span>
              <span className="font-bold">{formatEgp(r.roomTotal)}</span>
            </div>
            {r.discountAmount > 0 ? (
              <div className="mt-2 flex justify-between text-small">
                <span className="text-muted">Discount ({r.discountCode})</span>
                <span className="font-bold text-success">−{formatEgp(r.discountAmount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-border-subtle pt-2.5 text-body">
              <span className="font-semibold">Total (before VAT)</span>
              <span className="font-extrabold">{formatEgp(r.total)}</span>
            </div>
          </Card>
        </div>
      </div>

      {dialog === "check_in" ? (
        <CheckInDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "check_out" ? (
        <CheckOutDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "extend" ? (
        <ExtendStayDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "cancel" ? (
        <CancelDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "room" ? (
        <ChangeRoomDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "dates" ? (
        <ChangeDatesDialog reservation={r} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-[3px] text-faint">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}
