import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { GuestBooking } from "@/api/types";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { QueryState, Skeleton } from "@/components/QueryState";
import { useToast } from "@/components/Toast";
import { fmtStamp, money, plural, timeLeft } from "@/lib/format";
import { CheckoutSteps } from "./CheckoutSteps";
import { bookingPath, useBookingAccess, useGuestBooking } from "./hooks";
import { Page } from "./parts";
import { BookingError } from "./StatusPage";

export function PaymentPage() {
  const q = useGuestBooking();
  const { org, ref, k } = useBookingAccess();
  if (!k) return <BookingError />;
  return (
    <QueryState query={q} skeleton={<Page narrow><Skeleton className="h-72 w-full" /></Page>}>
      {(b) => (b.status === "AWAITING_PAYMENT" ? <Payment b={b} /> : <Navigate to={bookingPath(org, ref, k)} replace />)}
    </QueryState>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => toast.show(`${label} copied`), () => toast.show(`Select and copy the ${label.toLowerCase()} manually`));
      }}
      className="h-10 rounded-sm border border-rule-strong bg-surface px-3.5 text-[13px] font-semibold hover:border-ink"
    >
      Copy
    </button>
  );
}

function Payment({ b }: { b: GuestBooking }) {
  const { org, ref, k } = useBookingAccess();
  const nav = useNavigate();
  const toast = useToast();
  const [pick, setPick] = useState(0);
  const method = b.paymentMethods[pick];
  const total = money(b.totalMinor, b.currency);
  const left = timeLeft(b.holdExpiresAt);
  const copyText = (text: string, label: string) => () => void navigator.clipboard?.writeText(text).then(() => toast.show(`${label} copied`), () => undefined);

  return (
    <>
      <CheckoutSteps step={2} />
      <Page narrow className="flex flex-col gap-7">
        {b.rejectionReason ? (
          <Notice tone="bad">
            <strong>Your last proof was not accepted.</strong> {b.rejectionReason} You can send a new one below.
          </Notice>
        ) : null}
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-sm border border-used-line bg-used-bg px-4 py-3 text-sm text-used-ink">
          <strong>! Pay and upload proof by {fmtStamp(b.holdExpiresAt)}</strong>
          <span>{left === "expired" ? "time has run out" : `${left} left`} · unpaid bookings are released automatically.</span>
        </div>

        <div className="grid bg-ink text-paper sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 border-b border-ink-2 px-6 py-5 sm:border-b-0 sm:border-r">
            <span className="label tracking-[0.12em] text-[#b5aea3]">Amount to transfer · exact</span>
            <span className="font-mono text-[clamp(30px,4vw,42px)] font-semibold tracking-tight" data-testid="amount">{total}</span>
            <button type="button" onClick={copyText((b.totalMinor / 100).toFixed(2), "Amount")} className="self-start text-[13px] font-semibold text-brand-soft underline underline-offset-4">Copy amount</button>
          </div>
          <div className="flex flex-col gap-1.5 border-b border-ink-2 px-6 py-5 sm:border-b-0 sm:border-r">
            <span className="label tracking-[0.12em] text-[#b5aea3]">Booking reference · put in transfer note</span>
            <span className="font-mono text-[clamp(24px,3vw,32px)] font-semibold" data-testid="ref">{b.ref}</span>
            <button type="button" onClick={copyText(b.ref, "Reference")} className="self-start text-[13px] font-semibold text-brand-soft underline underline-offset-4">Copy reference</button>
          </div>
          <div className="flex flex-col gap-1.5 px-6 py-5">
            <span className="label tracking-[0.12em] text-[#b5aea3]">For</span>
            <span className="text-[15px] leading-snug">{b.event.title}<br />{plural(b.lines.reduce((n, l) => n + l.quantity, 0), "ticket")} · {fmtStamp(b.event.startsAt).split(",")[0]}</span>
          </div>
        </div>

        <div className="grid items-start gap-10 md:grid-cols-2">
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="display text-4xl text-brand">1</span>
              <h2 className="display-l text-3xl">Transfer the money</h2>
            </div>
            <span className="text-sm text-ink-2">Outside Admit, in your bank or wallet app. Choose a method:</span>
            {b.paymentMethods.length === 0 ? (
              <Notice tone="warn">The organizer has not set up payment details yet. Contact them with your reference {b.ref}.</Notice>
            ) : (
              <>
                <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
                  {b.paymentMethods.map((m, i) => (
                    <button key={m.id} role="radio" aria-checked={i === pick} onClick={() => setPick(i)} className={`flex min-h-[76px] flex-col gap-1 rounded-sm p-3 text-left ${i === pick ? "border-2 border-ink bg-surface" : "border border-rule-strong bg-paper"}`}>
                      <span className="text-[15px] font-semibold">{m.label}</span>
                      <span className="text-xs text-ink-2">{m.type === "instapay" ? "Bank app · instant" : m.type === "wallet" ? "Mobile wallet" : m.type === "bank" ? "Bank transfer" : "Other"}</span>
                    </button>
                  ))}
                </div>
                {method ? (
                  <div className="flex flex-col border border-ink bg-surface">
                    {[
                      [method.type === "instapay" ? "InstaPay address (IPA)" : method.type === "wallet" ? "Wallet number" : "Account / IBAN", method.identifier],
                      ["Recipient name", method.recipientName],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-rule px-4 py-3.5">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="label tracking-[0.06em] text-muted">{label}</span>
                          <span className="break-words font-mono text-[17px] font-semibold">{value}</span>
                        </div>
                        <CopyButton value={value!} label={label!} />
                      </div>
                    ))}
                    {method.instructions.length ? (
                      <ol className="m-0 flex flex-col gap-2.5 bg-paper py-4 pl-9 pr-4 text-[15px] leading-normal">
                        {method.instructions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="display text-4xl text-brand">2</span>
              <h2 className="display-l text-3xl">Send us the proof</h2>
            </div>
            <p className="text-[15px] leading-relaxed text-ink-3">Upload a screenshot of the confirmation showing the amount, date and time. The organizer checks it against their account, then issues your tickets.</p>
            <div className="flex flex-col gap-2.5 border border-rule-strong bg-surface p-4 text-sm leading-snug">
              <span className="font-semibold">A good screenshot shows</span>
              <span>✓ Amount: {total}</span>
              <span>✓ Recipient name or handle</span>
              <span>✓ Date, time and transaction ID</span>
              <span className="text-ink-2">Crop nothing out. Blurry or partial screenshots are the most common reason for rejection.</span>
            </div>
            <Button size="lg" block className="h-[52px] text-base" onClick={() => nav(bookingPath(org, ref, k, "upload"))}>
              I have transferred — upload proof
            </Button>
            <span className="text-center text-[13px] text-ink-2">
              Not ready? We emailed these instructions to {b.customer.emailMasked}. <Link to={bookingPath(org, ref, k)} className="font-semibold">Booking status</Link>
            </span>
          </section>
        </div>
      </Page>
    </>
  );
}
