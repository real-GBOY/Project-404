import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { QueryState, Skeleton } from "@/components/QueryState";
import type { PublicEvent } from "@/api/types";
import { fmtLongDate, fmtTime, money, moneyShort } from "@/lib/format";
import { canAdd, cartCount, cartTotal, loadCart, saveCart, type Cart } from "./cart";
import { Cover, Facts, Page } from "./parts";
import { useOrg, usePublicEvent } from "./hooks";

export function EventPage() {
  const q = usePublicEvent();
  return (
    <QueryState query={q} skeleton={<Page><Skeleton className="h-96 w-full" /></Page>}>
      {(e) => <EventView event={e} />}
    </QueryState>
  );
}

function EventView({ event }: { event: PublicEvent }) {
  const org = useOrg();
  const nav = useNavigate();
  const [cart, setCart] = useState<Cart>(() => loadCart(org, event.slug));
  useEffect(() => saveCart(org, event.slug, cart), [org, event.slug, cart]);

  // A reload may bring a stale cart: drop anything that is no longer on sale or exceeds what is left.
  const clean = useMemo(() => {
    const out: Cart = {};
    for (const t of event.ticketTypes) {
      const q = Math.min(cart[t.id] ?? 0, t.remaining, t.maxPerBooking);
      if (t.onSale && q > 0) out[t.id] = q;
    }
    return out;
  }, [cart, event.ticketTypes]);

  const count = cartCount(clean);
  const total = cartTotal(event, clean);
  const atMax = count >= event.maxPerBooking;
  const bookable = event.availability !== "ended" && event.availability !== "sold_out";
  const set = (id: string, q: number) => setCart({ ...clean, [id]: q });

  return (
    <div className="flex flex-col">
      <Cover url={event.coverUrl} night ratio="21/9" label="event cover" className="max-h-[380px]" />
      <Page className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3.5">
            {event.category ? <span className="label tracking-[0.12em] text-brand-deep">{event.category}</span> : null}
            <h1 className="display text-5xl md:text-7xl">{event.title}</h1>
            <span className="text-[15px] text-ink-2">
              Presented by <strong className="text-ink">{event.organizer.name}</strong>
            </span>
          </div>
          <Facts
            rows={[
              ["Date", fmtLongDate(event.startsAt)],
              ["Time", <span key="t" className="font-mono">{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}</span>],
              ["Venue", `${event.venue.name}${event.venue.area ? `, ${event.venue.area}` : ""}`],
            ]}
          />
          {event.description ? (
            <section className="flex max-w-[640px] flex-col gap-3">
              <h2 className="text-xl font-semibold">About</h2>
              {event.description.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-ink-3">{p}</p>
              ))}
            </section>
          ) : null}
          {event.program.length ? (
            <section className="flex max-w-[640px] flex-col">
              <h2 className="mb-2.5 text-xl font-semibold">Program</h2>
              {event.program.map((p, i) => (
                <div key={i} className="grid grid-cols-[80px_1fr] gap-4 border-t border-rule py-3">
                  <span className="font-mono text-sm text-brand-deep">{p.time}</span>
                  <span className="text-[15px]">{p.title}</span>
                </div>
              ))}
            </section>
          ) : null}
          <div className="grid max-w-[640px] gap-5 sm:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Venue</h2>
              <span className="text-sm leading-normal text-ink-2">
                {event.venue.name}
                <br />
                {event.venue.address}
              </span>
              {event.venue.mapUrl ? <a href={event.venue.mapUrl} className="text-sm font-semibold" target="_blank" rel="noreferrer">Open in maps ↗</a> : null}
            </section>
            {Object.keys(event.policies).length ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">Policies</h2>
                <ul className="m-0 list-disc pl-[18px] text-sm leading-relaxed text-ink-2">
                  {event.policies.age ? <li>{event.policies.age}</li> : null}
                  {event.policies.refund ? <li>{event.policies.refund}</li> : null}
                  {event.policies.entry ? <li>{event.policies.entry}</li> : null}
                </ul>
                {event.organizer.supportEmail ? (
                  <span className="text-sm text-ink-2">
                    Questions? <a href={`mailto:${event.organizer.supportEmail}`}>{event.organizer.supportEmail}</a>
                  </span>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col border border-ink bg-surface lg:sticky lg:top-4" aria-label="Tickets">
          <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
            <h2 className="display-l text-[26px]">Tickets</h2>
            <span className="text-xs text-muted">Max {event.maxPerBooking} per booking</span>
          </div>
          {event.ticketTypes.map((t) => {
            const soldOut = t.remaining === 0 || !t.onSale;
            const q = clean[t.id] ?? 0;
            const left = t.remaining <= 40 && t.remaining > 0 ? `${t.remaining >= 99 ? "99+" : t.remaining} left` : soldOut ? "All taken" : "Available";
            return (
              <div key={t.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 border-t border-rule px-5 py-4 ${soldOut ? "opacity-60" : ""}`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold">{t.name}</span>
                  {t.description ? <span className="text-[13px] leading-snug text-ink-2">{t.description}</span> : null}
                </div>
                <span className="text-right font-mono text-[15px] font-semibold">{moneyShort(t.priceMinor, event.currency)}</span>
                <span className={`text-xs font-medium ${soldOut ? "text-off-fg" : t.remaining <= 40 ? "text-used-fg" : "text-ok-fg"}`}>{left}</span>
                {soldOut ? (
                  <span className="justify-self-end rounded-full bg-sunken px-2.5 py-1.5 text-[13px] font-semibold text-off-fg">— Sold out</span>
                ) : (
                  <div role="group" aria-label={`${t.name} quantity`} className="flex items-center justify-self-end rounded-sm border border-rule-strong">
                    <button aria-label={`Remove one ${t.name}`} disabled={q === 0} onClick={() => set(t.id, q - 1)} className="size-10 text-xl disabled:opacity-30">−</button>
                    <span aria-live="polite" className="w-8 text-center font-mono font-semibold">{q}</span>
                    <button aria-label={`Add one ${t.name}`} disabled={!canAdd(clean, t, event.maxPerBooking)} onClick={() => set(t.id, q + 1)} className="size-10 text-xl disabled:opacity-30">+</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-col gap-2 border-t border-ink bg-paper px-5 py-4">
            {event.ticketTypes.filter((t) => clean[t.id]).map((t) => (
              <div key={t.id} className="flex justify-between text-sm">
                <span>{clean[t.id]} × {t.name}</span>
                <span className="font-mono">{moneyShort(t.priceMinor * clean[t.id]!, event.currency)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-dashed border-rule-strong pt-2.5">
              <span className="font-semibold">Total</span>
              <span className="font-mono text-[22px] font-semibold" data-testid="cart-total">{money(total, event.currency)}</span>
            </div>
            {atMax ? <span className="text-xs text-used-fg">! You have reached the {event.maxPerBooking}-ticket limit for one booking.</span> : null}
            <Button size="lg" block className="mt-1.5 h-[52px] text-base" disabled={count === 0 || !bookable} onClick={() => nav(`/e/${org}/events/${event.slug}/details`)}>
              {!bookable ? (event.availability === "ended" ? "Event ended" : "Sold out") : count === 0 ? "Select tickets" : `Continue — ${money(total, event.currency)}`}
            </Button>
            <span className="text-xs leading-snug text-ink-2">Pay by bank app or wallet transfer after reserving. Tickets are issued once the organizer verifies your transfer.</span>
          </div>
        </aside>
      </Page>
    </div>
  );
}
