import { useState } from "react";
import { Link } from "react-router-dom";
import type { GuestTicket, GuestTickets } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { QueryState, Skeleton } from "@/components/QueryState";
import { useToast } from "@/components/Toast";
import { fmtLongDate, fmtStamp, fmtTime } from "@/lib/format";
import { TICKET } from "@/lib/status";
import { ApiError, assetUrl } from "@/services/http";
import { bookingPath, useBookingAccess, useGuestTickets } from "./hooks";
import { Page } from "./parts";
import { BookingError } from "./StatusPage";

export function TicketPage() {
  const q = useGuestTickets();
  const { org, ref, k } = useBookingAccess();
  if (!k) return <BookingError />;
  if (q.isError) return <BookingError expired={q.error instanceof ApiError && q.error.code === "admit.link_expired"} />;
  return (
    <QueryState query={q} skeleton={<Page narrow><Skeleton className="h-96 w-full" /></Page>}>
      {(d) =>
        d.bookingStatus !== "CONFIRMED" && d.tickets.length === 0 ? (
          <Page narrow="xs" className="flex flex-col gap-4">
            <h1 className="display text-5xl">No tickets yet</h1>
            <p className="text-[15px] leading-relaxed text-ink-2">Tickets appear here once the organizer has verified your payment. This is not a ticket.</p>
            <Link to={bookingPath(org, ref, k)} className="font-semibold">Check booking status</Link>
          </Page>
        ) : (
          <Tickets d={d} />
        )
      }
    </QueryState>
  );
}

function Tickets({ d }: { d: GuestTickets }) {
  const { ref } = useBookingAccess();
  const toast = useToast();
  const live = d.tickets;
  const [i, setI] = useState(0);
  const t = live[Math.min(i, live.length - 1)]!;
  const share = async (x: GuestTicket) => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${d.event.title} - ticket for ${x.holderName}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.show("Link copied");
      }
    } catch {
      /* the person closed the share sheet */
    }
  };
  return (
    <Page narrow className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3.5 justify-self-center">
        {live.length > 1 ? (
          <div role="tablist" aria-label="Tickets in this booking" className="flex gap-1.5">
            {live.map((x, n) => (
              <button key={x.id} role="tab" aria-selected={n === i} onClick={() => setI(n)} className={`h-11 flex-1 rounded-sm text-[13px] font-semibold ${n === i ? "border-2 border-ink bg-surface" : "border border-rule-strong"}`}>
                {n + 1} · {x.holderName.split(" ")[0]}
              </button>
            ))}
          </div>
        ) : null}
        <article aria-label="Ticket" className="flex flex-col overflow-hidden rounded-[14px] bg-surface shadow-[0_0_0_1px_rgba(22,20,15,0.12),0_18px_40px_-20px_rgba(22,20,15,0.35)]">
          <div className="relative flex flex-col gap-3 bg-night px-5 pb-5 pt-[18px] text-paper">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="font-display text-base font-black tracking-wider" style={{ fontStretch: "70%" }}>ADMIT</span><span className="size-1.5 rounded-full bg-brand" /></span>
              <span className="font-mono text-[11px] text-[#b5aea3]">TICKET {i + 1} OF {live.length}</span>
            </div>
            <span className="display text-[38px]">{d.event.title}</span>
            <div className="grid grid-cols-2 gap-2.5 text-[13px]">
              <div className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-widest text-faint">Date</span><span className="font-mono">{fmtLongDate(d.event.startsAt).replace(/^\w+ /, "")}</span></div>
              <div className="flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-widest text-faint">Time</span><span className="font-mono">{fmtTime(d.event.startsAt)}</span></div>
              <div className="col-span-2 flex flex-col gap-0.5"><span className="text-[10px] uppercase tracking-widest text-faint">Venue</span><span>{d.event.venue.name}{d.event.venue.address ? `, ${d.event.venue.address}` : ""}</span></div>
            </div>
          </div>
          <div className="relative h-5 bg-surface" aria-hidden="true">
            <div className="absolute -left-2.5 top-0 size-5 rounded-full bg-paper" />
            <div className="absolute -right-2.5 top-0 size-5 rounded-full bg-paper" />
            <div className="absolute inset-x-[18px] top-[9px] border-t-2 border-dashed border-rule-strong" />
          </div>
          <div className="flex flex-col items-center gap-4 px-5 pb-5 pt-1">
            <div className="grid w-full grid-cols-2 gap-2.5 text-sm">
              <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Holder</span><span className="font-semibold">{t.holderName}</span></div>
              <div className="flex flex-col gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Type</span><span className="font-semibold">{t.ticketType}</span></div>
            </div>
            <div className="rounded-lg border border-rule bg-white p-4">
              {t.qrImageUrl && t.status !== "REVOKED" ? (
                <img src={assetUrl(t.qrImageUrl)} alt={`QR code for ticket ${t.id}`} width={220} height={220} className="size-[220px] bg-white" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="flex size-[220px] items-center justify-center text-center font-mono text-xs text-muted">No code: this ticket was revoked</div>
              )}
            </div>
            <span className="font-mono text-base font-semibold tracking-wider" data-testid="ticket-id">{t.id}</span>
            <Badge size="md" status={t.status === "USED" ? { tone: "used", glyph: "!", label: `Used${t.checkedInAt ? ` · ${fmtStamp(t.checkedInAt)}` : ""}` } : TICKET[t.status]} />
            <span className="max-w-[300px] text-center text-[13px] leading-normal text-ink-2">Show this code at the entrance. It admits one person, once. Turn your screen brightness up.</span>
          </div>
        </article>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1 text-sm" onClick={() => window.print()}>Print / save PDF</Button>
          <Button variant="secondary" size="lg" className="flex-1 text-sm" onClick={() => void share(t)}>Share ticket {i + 1}</Button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <h1 className="display text-5xl">{live.length} {live.length === 1 ? "ticket" : "tickets"} · {ref}</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">Each ticket has its own code and works once. Send each holder their ticket with Share; they do not need an account.</p>
        {d.tickets.some((x) => x.status === "REVOKED") ? <Notice tone="warn">Some tickets in this booking were revoked by the organizer and no longer work.</Notice> : null}
        <div className="border-t-2 border-ink">
          {live.map((x, n) => (
            <button key={x.id} onClick={() => setI(n)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-rule bg-transparent py-3 text-left">
              <span className="font-semibold">{x.holderName}</span>
              <Badge status={TICKET[x.status]} />
              <span className="text-[13px] text-ink-2">{x.ticketType} · <span className="font-mono">{x.id}</span></span>
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}
