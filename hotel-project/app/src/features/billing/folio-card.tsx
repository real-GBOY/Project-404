import { useState } from "react";
import { Link } from "react-router-dom";
import { METHOD_LABEL, useFolio } from "@/api/billing";
import type { Reservation } from "@/api/reservations";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/states";
import { formatEgp, formatIsoDate, formatRelative } from "@/lib/format";
import { CollectPaymentDialog, PostChargeDialog } from "./folio-dialogs";

/**
 * The design's "Payment Summary" (Total / Paid / Remaining + Collect Payment), backed by the
 * ledger: before check-in the total is what the stay will cost; after check-in it is the posted
 * folio. Below it, the folio lines and payment history.
 */
export function FolioCard({ reservation }: { reservation: Reservation }) {
  const auth = useAuth();
  const folio = useFolio(reservation.id, auth.can("read:folio"));
  const [dialog, setDialog] = useState<"pay" | "charge" | null>(null);

  if (!auth.can("read:folio")) return null;
  if (!folio.data)
    return (
      <Card>
        <LoadingState />
      </Card>
    );
  const { totals, charges, payments, invoiceId } = folio.data;
  const open = ["pending", "confirmed", "checked_in"].includes(reservation.status);
  const activeCharges = charges.filter((c) => !c.voidedAt);

  return (
    <>
      <Card>
        <div className="mb-3.5 flex items-center justify-between">
          <CardTitle className="m-0">Payment Summary</CardTitle>
          <StatusBadge status={totals.paymentStatus} />
        </div>
        <Line
          label={totals.posted ? "Total" : "Expected total"}
          value={`${formatEgp(totals.total)}`}
          strong
        />
        <Line label="Paid" value={formatEgp(totals.paid)} tone="text-success" />
        <div className="mb-3.5 border-b border-border-subtle pb-3.5">
          <Line
            label="Remaining"
            value={formatEgp(Math.max(totals.balance, 0))}
            tone="text-danger"
            strong
          />
          {totals.balance < 0 ? (
            <Line label="Overpaid" value={formatEgp(-totals.balance)} tone="text-warning-strong" />
          ) : null}
        </div>
        {open && auth.can("create:payment") && totals.balance > 0 ? (
          <Button className="w-full" size="sm" onClick={() => setDialog("pay")}>
            Collect Payment
          </Button>
        ) : null}
        {reservation.status === "checked_in" && auth.can("post:charge") ? (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            size="sm"
            onClick={() => setDialog("charge")}
          >
            Add charge
          </Button>
        ) : null}
        {invoiceId && auth.can("read:invoice") ? (
          <Link
            to={`/invoices/${invoiceId}`}
            className="mt-3 block text-center text-small font-semibold text-primary hover:text-primary-strong"
          >
            View invoice →
          </Link>
        ) : null}

        {activeCharges.length > 0 ? (
          <div className="mt-4 border-t border-border-subtle pt-3.5">
            <div className="mb-2 text-label font-bold tracking-[0.04em] text-faint uppercase">
              Folio
            </div>
            <ul className="m-0 list-none p-0">
              {activeCharges.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-1 text-small">
                  <span className="text-muted">
                    {c.kind === "room" ? formatIsoDate(c.serviceDate) : c.description}
                    {c.quantity > 1 ? ` × ${c.quantity}` : ""}
                  </span>
                  <span className="shrink-0 font-semibold">{formatEgp(c.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex justify-between text-small">
              <span className="text-muted">VAT</span>
              <span className="font-semibold">{formatEgp(totals.tax)}</span>
            </div>
          </div>
        ) : null}

        {payments.length > 0 ? (
          <div className="mt-4 border-t border-border-subtle pt-3.5">
            <div className="mb-2 text-label font-bold tracking-[0.04em] text-faint uppercase">
              Payments
            </div>
            <ul className="m-0 list-none p-0">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-1.5 text-small"
                >
                  <span>
                    <span className="font-semibold">{METHOD_LABEL[p.method]}</span>
                    <span className="ml-1.5 text-label text-faint">
                      {p.receivedByName ?? "—"} · {formatRelative(p.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{formatEgp(p.amount)}</span>
                    {p.status !== "completed" ? <StatusBadge status={p.status} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      {dialog === "pay" ? (
        <CollectPaymentDialog
          reservationId={reservation.id}
          balance={totals.balance}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "charge" ? (
        <PostChargeDialog reservationId={reservation.id} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

function Line({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="mb-2 flex justify-between text-small">
      <span className="text-muted">{label}</span>
      <span className={`${strong ? "font-bold" : "font-semibold"} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
