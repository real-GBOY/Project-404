import { Link, Navigate } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { QueryState, Skeleton } from "@/components/QueryState";
import { fmtWhen, money, plural } from "@/lib/format";
import { BOOKING } from "@/lib/status";
import { bookingPath, useBookingAccess, useGuestBooking, useOrg } from "./hooks";
import { Page } from "./parts";
import { BookingError } from "./StatusPage";

/** Step 5: the proof is in. Says plainly that this page is not a ticket and nothing is paid until the organizer confirms. */
export function SubmittedPage() {
  const q = useGuestBooking();
  const { org, ref, k } = useBookingAccess();
  const slug = useOrg();
  if (!k) return <BookingError />;
  return (
    <QueryState
      query={q}
      skeleton={
        <Page narrow="xs">
          <Skeleton className="h-64 w-full" />
        </Page>
      }
    >
      {(b) =>
        b.status !== "IN_REVIEW" ? (
          <Navigate to={bookingPath(org, ref, k)} replace />
        ) : (
          <Page narrow="xs" className="flex flex-col gap-6 pt-12">
            <Badge status={BOOKING.IN_REVIEW} size="lg" />
            <h1 className="display text-5xl md:text-7xl">
              Proof received. We are verifying your transfer.
            </h1>
            <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-3">
              Your booking is reserved but <strong>not yet paid</strong>. When the organizer
              confirms the transfer, your{" "}
              {plural(b.ticketCount || b.lines.reduce((n, l) => n + l.quantity, 0), "ticket")} will be emailed to{" "}
              <strong>{b.customer.emailMasked}</strong>.
            </p>
            <dl className="m-0 grid border border-ink bg-surface sm:grid-cols-3">
              {[
                [
                  "Reference",
                  <span key="r" className="font-mono text-[17px] font-semibold">
                    {b.ref}
                  </span>,
                ],
                [
                  "Event",
                  <span key="e" className="text-sm font-semibold leading-snug">
                    {b.event.title} · {fmtWhen(b.event.startsAt)}
                  </span>,
                ],
                [
                  "Submitted",
                  <span key="s" className="font-mono text-sm">
                    {money(b.totalMinor, b.currency)}
                  </span>,
                ],
              ].map(([k2, v], i) => (
                <div
                  key={String(k2)}
                  className={`flex flex-col gap-1 p-4 ${i ? "sm:border-l sm:border-rule" : ""}`}
                >
                  <dt className="label tracking-widest text-muted">{k2}</dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-dashed border-rule-strong pt-4 text-sm leading-normal text-ink-2">
              This page is not a ticket. Tickets with QR codes appear only after verification.
              Bookmark your status link or use the one in your email.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link
                to={bookingPath(org, ref, k)}
                className="inline-flex h-12 items-center rounded-sm bg-ink px-5 text-[15px] font-semibold text-paper no-underline hover:text-paper"
              >
                Track booking status
              </Link>
              <Link
                to={`/e/${slug}`}
                className="inline-flex h-12 items-center rounded-sm border border-ink px-5 text-[15px] font-semibold no-underline"
              >
                Back to events
              </Link>
            </div>
          </Page>
        )
      }
    </QueryState>
  );
}
