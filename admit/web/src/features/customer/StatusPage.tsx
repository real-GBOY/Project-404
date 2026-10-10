import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publicApi } from "@/api";
import type { GuestBooking } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Notice } from "@/components/Notice";
import { QueryState, Skeleton } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fmtStamp, fmtWhen, money, timeLeft } from "@/lib/format";
import { BOOKING } from "@/lib/status";
import { ApiError } from "@/services/http";
import { bookingPath, qk, ticketsPath, useBookingAccess, useGuestBooking, useOrg } from "./hooks";
import { Cover, Page } from "./parts";
import { buildSteps, type StepState } from "./status-steps";
import { FindBookingForm } from "./FindBookingPage";

/** Shown when a booking link is missing, wrong or old. Never says which, so a reference cannot be probed. */
export function BookingError({ expired }: { expired?: boolean }) {
  return (
    <Page narrow="xs" className="flex flex-col gap-5">
      <h1 className="display text-5xl">{expired ? "This link has expired" : "We could not find that booking"}</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">
        {expired ? "For your security, booking links stop working after a while." : "The link may be incomplete, or the booking may belong to a different address."} Enter your reference and email and we will send a fresh link.
      </p>
      <FindBookingForm />
    </Page>
  );
}

const DOT: Record<StepState, string> = {
  done: "bg-ink text-white",
  now: "bg-pending-bg text-pending-fg border-2 border-pending-fg",
  act: "bg-surface text-ink border-2 border-ink",
  fail: "bg-bad-solid text-white",
  todo: "bg-surface text-muted border border-rule-strong",
};
const GLYPH: Record<StepState, string> = { done: "✓", now: "◷", act: "→", fail: "✕", todo: "" };

export function Timeline({ b }: { b: GuestBooking }) {
  return (
    <ol aria-label="Booking timeline" className="m-0 mt-2 list-none border-t-2 border-ink p-0">
      {buildSteps(b).map((s) => (
        <li key={s.label} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-3 ${s.state === "todo" ? "text-muted" : s.state === "fail" ? "text-bad-fg" : ""}`}>
          <span aria-hidden="true" className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${DOT[s.state]}`}>{GLYPH[s.state]}</span>
          <span className={`text-[15px] ${s.state === "now" || s.state === "act" || s.state === "fail" ? "font-bold" : s.state === "done" ? "font-medium" : ""}`}>{s.label}</span>
          <span className="font-mono text-xs text-muted">{s.when}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatusPage() {
  const q = useGuestBooking(true);
  const { k } = useBookingAccess();
  if (!k) return <BookingError />;
  if (q.isError) {
    return <BookingError expired={q.error instanceof ApiError && q.error.code === "admit.link_expired"} />;
  }
  return (
    <QueryState query={q} skeleton={<Page narrow><Skeleton className="h-72 w-full" /></Page>}>
      {(b) => <Status b={b} />}
    </QueryState>
  );
}

function Status({ b }: { b: GuestBooking }) {
  const { org, ref, k } = useBookingAccess();
  const orgSlug = useOrg();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = useMutation({
    mutationFn: () => publicApi.cancel(org, ref, k),
    onSuccess: (data) => {
      qc.setQueryData(qk.booking(org, ref), data);
      setConfirmCancel(false);
    },
  });
  const st = BOOKING[b.status];
  const total = money(b.totalMinor, b.currency);
  const left = timeLeft(b.holdExpiresAt);

  const copy: Record<GuestBooking["status"], { title: string; body: string }> = {
    AWAITING_PAYMENT: { title: b.rejectionReason ? "We could not verify your payment" : "Complete your payment", body: b.rejectionReason ? `Send a corrected transfer or a clearer screenshot. Your tickets are held until ${fmtStamp(b.holdExpiresAt)}.` : `Transfer ${total} and upload proof by ${fmtStamp(b.holdExpiresAt)} (${left} left). Unpaid bookings are released automatically.` },
    IN_REVIEW: { title: "We are verifying your transfer", body: "The organizer checks every transfer against their account, usually within a few working hours. You will get an email the moment your tickets are issued. This page updates by itself." },
    CONFIRMED: { title: "Your tickets are ready", body: `Payment verified. ${b.ticketCount} ${b.ticketCount === 1 ? "ticket was" : "tickets were"} issued${b.emailStatus === "ACCEPTED" || b.emailStatus === "DELIVERED" ? ` and emailed to ${b.customer.emailMasked}` : ""}.` },
    REJECTED: { title: "We could not verify your payment", body: "The time to resubmit has ended, so the tickets were released. If you already sent money, contact the organizer with your reference and they will sort it out." },
    EXPIRED: { title: "This booking has expired", body: `No proof of payment arrived before ${fmtStamp(b.holdExpiresAt)}, so the tickets were released. If you already sent money, contact the organizer with your reference and they will sort it out.` },
    CANCELLED: { title: "This booking was cancelled", body: "Any tickets on it no longer work. If you paid and this is unexpected, contact the organizer with your reference." },
  };
  const c = copy[b.status];

  return (
    <Page narrow className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm text-ink-2">Booking {b.ref}</span>
        <Link to={`/e/${orgSlug}`} className="text-sm font-semibold">← All events</Link>
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Badge status={st} size="lg" />
          <h1 className="display text-5xl md:text-6xl">{c.title}</h1>
          <p className="max-w-[540px] text-base leading-relaxed text-ink-3">{c.body}</p>
          {b.rejectionReason && (b.status === "AWAITING_PAYMENT" || b.status === "REJECTED") ? (
            <div className="rounded-sm border border-bad-line bg-bad-bg px-4 py-3.5 text-sm leading-normal text-bad-ink"><strong>Note from the organizer:</strong> {b.rejectionReason}</div>
          ) : null}
          {b.status === "CONFIRMED" && b.emailStatus === "FAILED" ? (
            <Notice tone="warn"><strong>The confirmation email did not reach you.</strong> Your tickets are issued and safe — open them below, or save this page.</Notice>
          ) : null}
          <div className="flex flex-wrap gap-2.5">
            {b.status === "CONFIRMED" ? <Button onClick={() => nav(ticketsPath(org, ref, k))}>View tickets</Button> : null}
            {b.status === "AWAITING_PAYMENT" ? <Button onClick={() => nav(bookingPath(org, ref, k, b.rejectionReason ? "upload" : "pay"))}>{b.rejectionReason ? "Upload new proof" : "Continue to payment"}</Button> : null}
            {(b.status === "EXPIRED" || b.status === "CANCELLED" || b.status === "REJECTED") ? <Button onClick={() => nav(`/e/${orgSlug}/events/${b.event.slug}`)}>Book again</Button> : null}
            {b.status === "AWAITING_PAYMENT" ? <Button variant="secondary" onClick={() => setConfirmCancel(true)}>Cancel booking</Button> : null}
          </div>
          <Timeline b={b} />
        </div>
        <aside className="flex flex-col border border-ink bg-surface">
          <Cover url={b.event.coverUrl} ratio="16/9" label="event cover" />
          <div className="flex flex-col gap-1.5 border-b border-rule p-4">
            <span className="display-l text-[22px]">{b.event.title}</span>
            <span className="font-mono text-[13px] text-ink-2">{fmtWhen(b.event.startsAt)}</span>
            <span className="text-[13px] text-ink-2">{b.event.venue.name}{b.event.venue.area ? `, ${b.event.venue.area}` : ""}</span>
          </div>
          <div className="flex flex-col gap-2 p-4 text-sm">
            {b.lines.map((l) => (
              <div key={l.ticketTypeId} className="flex justify-between"><span>{l.quantity} × {l.name}</span><span className="font-mono">{money(l.totalMinor, b.currency)}</span></div>
            ))}
            <div className="flex justify-between border-t border-dashed border-rule-strong pt-2 font-semibold"><span>Total</span><span className="font-mono">{total}</span></div>
            <div className="flex justify-between text-ink-2"><span>Booked by</span><span>{b.customer.name}</span></div>
          </div>
        </aside>
      </div>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this booking?">
        <p className="px-[22px] pt-2.5 text-sm leading-normal text-ink-2">Your held tickets go back on sale straight away. You have not paid anything through Admit, so there is nothing to refund here. This cannot be undone.</p>
        {cancel.isError ? <p role="alert" className="px-[22px] pt-2 text-sm text-bad-solid">{errorText(cancel.error)}</p> : null}
        <div className="flex justify-end gap-2 p-[22px]">
          <Button variant="secondary" size="md" onClick={() => setConfirmCancel(false)}>Keep booking</Button>
          <Button variant="ink" size="md" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel booking</Button>
        </div>
      </Dialog>
    </Page>
  );
}
