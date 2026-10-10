import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { publicApi } from "@/api";
import type { PublicEvent } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorSummary, TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { QueryState } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fmtWhen, money, plural } from "@/lib/format";
import { ApiError } from "@/services/http";
import { cartCount, cartTotal, clearCart, loadCart } from "./cart";
import { bookingPath, useOrg, usePublicEvent } from "./hooks";
import { Page } from "./parts";
import { CheckoutSteps } from "./CheckoutSteps";
import { validateDetails, validateField, type DetailsInput } from "./validation";

/** Server paths -> the form's field ids. */
function fieldIdFor(path: string): string {
  if (path.startsWith("customer.")) return path.slice("customer.".length);
  const m = /holderNames\.(\d+)/.exec(path);
  if (m) return `holder-${m[1]}`;
  if (path === "policyAck") return "policy";
  return "form";
}

export function DetailsPage() {
  const q = usePublicEvent();
  return <QueryState query={q}>{(e) => <DetailsForm event={e} />}</QueryState>;
}

function DetailsForm({ event }: { event: PublicEvent }) {
  const org = useOrg();
  const nav = useNavigate();
  const cart = useMemo(() => loadCart(org, event.slug), [org, event.slug]);
  const lines = event.ticketTypes.filter((t) => cart[t.id]);
  const count = cartCount(cart);
  const hasPolicies = Object.keys(event.policies).length > 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [holders, setHolders] = useState<string[]>(() => Array.from({ length: count }, () => ""));
  const [policyAck, setPolicyAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  // one key per visit to this form: a double click or a retried request returns the first booking instead of booking twice
  const idemKey = useRef(`web-${crypto.randomUUID().replaceAll("-", "")}`);

  const input = (): DetailsInput => ({ name, email, phone, holders, namedTickets: event.namedTickets, hasPolicies, policyAck });

  const book = useMutation({
    mutationFn: () => {
      let n = 0;
      const items = lines.map((t) => {
        const qty = cart[t.id]!;
        const names = holders.slice(n, n + qty).map((h) => h.trim());
        n += qty;
        return { ticketTypeId: t.id, quantity: qty, ...(event.namedTickets ? { holderNames: names } : {}) };
      });
      return publicApi.book(org, event.slug, { items, customer: { name: name.trim(), email: email.trim(), phone: phone.trim() }, policyAck }, idemKey.current);
    },
    onSuccess: (r) => {
      clearCart(org, event.slug);
      const k = new URL(r.links.status).searchParams.get("k") ?? "";
      nav(bookingPath(org, r.ref, k, "pay"), { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields.length) {
        const next: Record<string, string> = {};
        for (const f of err.fields) next[fieldIdFor(f.path)] = f.message;
        setErrors(next);
        setServerMsg(null);
        requestAnimationFrame(() => summary.current?.focus());
      } else {
        setServerMsg(err instanceof ApiError && err.code === "admit.sold_out" ? `${err.message} Go back and adjust your tickets.` : errorText(err));
      }
    },
  });

  if (count === 0) return <Navigate to={`/e/${org}/events/${event.slug}`} replace />;

  const blur = (id: string) => () => {
    const m = validateField(id, input());
    setErrors((prev) => {
      const next = { ...prev };
      if (m) next[id] = m;
      else delete next[id];
      return next;
    });
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDetails(input());
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setServerMsg(null);
    book.mutate();
  };

  const labelFor = (id: string) => (id === "name" ? "Full name" : id === "email" ? "Email" : id === "phone" ? "Mobile number" : id === "policy" ? "Event policies" : id.startsWith("holder-") ? `Ticket ${Number(id.slice(7)) + 1}` : id);
  const summaryErrors = Object.entries(errors).filter(([id]) => id !== "form").map(([id, message]) => ({ id: id === "policy" ? "policy" : id, message: `${labelFor(id)}: ${message}` }));

  let ticketNo = 0;
  return (
    <>
      <CheckoutSteps step={1} />
      <Page narrow className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form id="details-form" onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-7" aria-label="Your details">
          <h1 className="display text-5xl">Your details</h1>
          <ErrorSummary errors={summaryErrors} focusRef={summary} />
          {serverMsg ? <Notice tone="bad">{serverMsg}</Notice> : null}

          <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className="label mb-3 text-ink-2">Contact · booking owner</legend>
            <TextField fieldId="name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} onBlur={blur("name")} autoComplete="name" error={errors.name} />
            <TextField fieldId="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={blur("email")} autoComplete="email" error={errors.email} hint="Payment instructions and tickets go here." />
            <TextField fieldId="phone" label="Mobile number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={blur("phone")} autoComplete="tel" error={errors.phone} hint="The organizer uses this only if there is a problem with your payment." />
          </fieldset>

          {event.namedTickets ? (
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="label mb-3 text-ink-2">Ticket holders</legend>
              <span className="text-sm leading-snug text-ink-2">Each ticket gets its own QR code and is checked against the holder's name at the door.</span>
              {lines.flatMap((t) =>
                Array.from({ length: cart[t.id]! }, () => {
                  const n = ticketNo++;
                  const id = `holder-${n}`;
                  return (
                    <div key={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 border border-rule bg-surface p-3.5">
                      <TextField
                        fieldId={id}
                        label={`Ticket ${n + 1} · ${t.name}`}
                        placeholder="Holder's full name"
                        value={holders[n] ?? ""}
                        onChange={(e) => setHolders((h) => h.map((v, i) => (i === n ? e.target.value : v)))}
                        onBlur={blur(id)}
                        error={errors[id]}
                        className="h-11"
                      />
                      {n === 0 ? (
                        <button type="button" className="pb-3 text-xs text-muted underline" onClick={() => setHolders((h) => h.map((v, i) => (i === 0 ? name : v)))}>
                          Use my name
                        </button>
                      ) : null}
                    </div>
                  );
                }),
              )}
            </fieldset>
          ) : null}

          {hasPolicies ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-normal">
                <input
                  id="policy"
                  type="checkbox"
                  checked={policyAck}
                  aria-invalid={errors.policy ? true : undefined}
                  onChange={(e) => {
                    setPolicyAck(e.target.checked);
                    setErrors((p) => { const n = { ...p }; delete n.policy; return n; });
                  }}
                  className="mt-0.5 size-5 accent-ink"
                />
                <span>I have read the event policies{event.policies.refund ? ", including the refund terms" : ""}. I understand tickets are issued only after my transfer is verified.</span>
              </label>
              {errors.policy ? <span className="text-xs font-medium text-bad-solid">✕ {errors.policy}</span> : null}
            </div>
          ) : null}
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <div className="border border-ink bg-surface">
            <div className="grid grid-cols-[96px_1fr] border-b border-rule">
              <div className="stripes" />
              <div className="flex flex-col gap-1 p-3.5">
                <span className="display-l text-xl">{event.title}</span>
                <span className="font-mono text-[13px] text-ink-2">{fmtWhen(event.startsAt)}</span>
                <span className="text-[13px] text-ink-2">{event.venue.name}{event.venue.area ? `, ${event.venue.area}` : ""}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {lines.map((t) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span>{cart[t.id]} × {t.name}</span>
                  <span className="font-mono">{money(t.priceMinor * cart[t.id]!, event.currency)}</span>
                </div>
              ))}
              <Link to={`/e/${org}/events/${event.slug}`} className="self-start text-[13px] font-semibold">Change tickets</Link>
              <div className="flex items-baseline justify-between border-t border-dashed border-rule-strong pt-2.5">
                <span className="font-semibold">Total to transfer</span>
                <span className="font-mono text-[22px] font-semibold">{money(cartTotal(event, cart), event.currency)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-3">
            <span className="label text-ink-2">What happens next</span>
            {[`We hold your ${plural(count, "ticket")} for ${event.ticketTypes.length ? "24 hours" : "a day"} and show the payment details.`, "You transfer the exact amount from your bank app or wallet.", "You upload a screenshot of the transfer.", "The organizer verifies it and your tickets are emailed to you."].map((t, i) => (
              <div key={i} className="grid grid-cols-[24px_1fr] gap-2 text-sm leading-snug">
                <span className="font-mono text-brand-deep">{i + 1}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <Button type="submit" form="details-form" size="lg" block className="h-[52px] text-base" loading={book.isPending}>
            {book.isPending ? "Reserving…" : "Reserve & get payment details"}
          </Button>
          <span className="text-center text-xs text-muted">Your seats are held after reserving. Nothing is charged by Admit.</span>
        </aside>
      </Page>
    </>
  );
}
