import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInvoice } from "@/api/billing";
import { useSettings } from "@/api/settings";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp, formatIsoDate, formatDate } from "@/lib/format";
import { VoidInvoiceDialog } from "./refund-dialogs";

/**
 * Invoice (design: "Invoice"): the frozen snapshot issued at check-out — items, subtotal, VAT at
 * the rate in force, total. Print uses the browser's print-to-PDF. Finance staff can void it
 * (with a reason); a void invoice stays readable, clearly marked, with why it was voided.
 */
export function InvoicePage() {
  const { invoiceId = "" } = useParams();
  const invoice = useInvoice(invoiceId);
  const settings = useSettings();
  const auth = useAuth();
  const [voiding, setVoiding] = useState(false);
  if (invoice.isLoading) return <LoadingState />;
  if (invoice.error || !invoice.data) return <ErrorState error={invoice.error} />;
  const inv = invoice.data;

  return (
    <>
      <Link
        to={`/reservations/${inv.reservation.id}`}
        className="mb-3.5 inline-block text-small font-semibold text-primary hover:text-primary-strong print:hidden"
      >
        ← Back to reservation {inv.reservation.code}
      </Link>
      {inv.status === "void" ? (
        <div
          role="status"
          className="mb-3.5 max-w-[560px] rounded-control bg-danger-soft px-3.5 py-2.5 text-small font-semibold text-danger print:hidden"
        >
          Void{inv.voidedAt ? ` since ${formatDate(inv.voidedAt)}` : ""}
          {inv.voidReason ? ` — ${inv.voidReason}` : ""}
        </div>
      ) : null}
      <article className="max-w-[560px] rounded-card border border-border bg-surface p-6 sm:p-9 print:border-0 print:p-0">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <div className="text-[18px] font-extrabold">
              {settings.data?.hotelName ?? "Hotel Transylvania"}
            </div>
            <div className="text-label text-muted">{settings.data?.address ?? "Cairo, Egypt"}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-body font-bold">{inv.number}</div>
            <div className="text-label text-muted">Booking #{inv.reservation.code}</div>
            <div className="text-label text-muted">{formatDate(inv.issuedAt)}</div>
            {inv.status === "void" ? (
              <StatusBadge status="cancelled" label="Void" className="mt-1" />
            ) : null}
          </div>
        </header>
        <div className="mb-1 text-small text-muted">Billed to</div>
        <div className="mb-0.5 text-title font-bold">{inv.billToName}</div>
        <div className="mb-6 text-small text-muted">
          Room {inv.reservation.roomNumber} · {inv.reservation.roomTypeName} ·{" "}
          {formatIsoDate(inv.reservation.arrival)} →{" "}
          {formatIsoDate(inv.reservation.departure, true)}
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 border-t border-border p-0 pt-4">
          {inv.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4 text-body">
              <span>
                {it.description}
                {it.quantity > 1 ? ` · ${it.quantity} × ${formatEgp(it.unitPrice)}` : ""}
              </span>
              <span className="shrink-0 font-semibold">{formatEgp(it.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3.5">
          <div className="flex justify-between text-small text-muted">
            <span>Subtotal</span>
            <span>{formatEgp(inv.subtotal)}</span>
          </div>
          <div className="flex justify-between text-small text-muted">
            <span>VAT ({Math.round(inv.taxRate * 10000) / 100}%)</span>
            <span>{formatEgp(inv.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-[19px] font-extrabold">
            <span>TOTAL</span>
            <span>{formatEgp(inv.total)}</span>
          </div>
        </div>
        <Button className="mt-6 w-full print:hidden" onClick={() => window.print()}>
          Print / Download PDF
        </Button>
        {inv.status === "issued" && auth.can("void:invoice") ? (
          <Button
            variant="secondary"
            className="mt-2 w-full print:hidden"
            onClick={() => setVoiding(true)}
          >
            Void invoice
          </Button>
        ) : null}
      </article>
      {voiding ? (
        <VoidInvoiceDialog
          invoiceId={inv.id}
          number={inv.number}
          reservationId={inv.reservation.id}
          onClose={() => setVoiding(false)}
        />
      ) : null}
    </>
  );
}
