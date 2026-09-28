import { useState } from "react";
import { Link } from "react-router-dom";
import { METHOD_LABEL, newIdempotencyKey, useFolio, type PaymentMethod } from "@/api/billing";
import { useCheckOut } from "@/api/front-desk";
import type { Reservation } from "@/api/reservations";
import { useAuth } from "@/features/auth/use-auth";
import { ApiError } from "@/config";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField } from "@/components/ui/fields";
import { LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatEgp } from "@/lib/format";

/**
 * Check-out (a design gap): the folio summary, settle the balance in the same action, and done —
 * the server issues the invoice, marks the room dirty and opens the cleaning task. The
 * idempotency key is fixed for this dialog, so a double-click or retry can't charge twice.
 * Staff who may refund (`create:refund`) also return any overpayment in the same step — including
 * credit that only appears when an early departure releases unused nights.
 */
export function CheckOutDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const auth = useAuth();
  const canRefund = auth.can("create:refund");
  const folio = useFolio(reservation.id);
  const checkOut = useCheckOut();
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const totals = folio.data?.totals;
  const balance = totals?.balance ?? 0;

  async function submit() {
    setError(null);
    try {
      const out = await checkOut.mutateAsync({
        id: reservation.id,
        payment: balance > 0 ? { method, amount: balance } : null,
        refund: canRefund,
        idempotencyKey: key,
      });
      toast(
        out.refunded
          ? `Guest checked out and the overpayment refunded — Room ${reservation.roomNumber} marked Dirty`
          : `Guest checked out — Room ${reservation.roomNumber} marked Dirty`,
      );
      setInvoiceId(out.invoiceId);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "checkout.refund_due"
          ? `${errorMessage(err)} Ask a manager or accountant to refund it.`
          : errorMessage(err),
      );
    }
  }

  return (
    <Dialog
      open
      title={invoiceId ? "Checked out" : `Check out ${reservation.guestName}`}
      description={`${reservation.code} · Room ${reservation.roomNumber}`}
      onClose={onClose}
      footer={
        invoiceId ? (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Link
              to={`/invoices/${invoiceId}`}
              className="rounded-control bg-primary px-4 py-[10px] text-small font-bold text-white"
            >
              View invoice
            </Link>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={!totals || (balance < 0 && !canRefund) || checkOut.isPending}
            >
              {checkOut.isPending
                ? "Checking out…"
                : balance > 0
                  ? `Take ${formatEgp(balance)} & check out`
                  : balance < 0
                    ? `Refund ${formatEgp(-balance)} & check out`
                    : "Check out"}
            </Button>
          </>
        )
      }
    >
      {!totals ? (
        <LoadingState />
      ) : invoiceId ? (
        <p className="m-0 text-small text-muted">
          The invoice is issued, the room is marked dirty and housekeeping has a task to turn it.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="m-0 flex flex-col gap-2 text-small">
            <Row label="Charges" value={formatEgp(totals.charges)} />
            <Row label="VAT" value={formatEgp(totals.tax)} />
            <Row label="Total" value={formatEgp(totals.total)} strong />
            <Row label="Paid" value={formatEgp(totals.paid)} tone="text-success" />
            <Row
              label={balance < 0 ? "Overpaid" : "Balance due"}
              value={formatEgp(Math.abs(balance))}
              tone={balance > 0 ? "text-danger" : undefined}
              strong
            />
          </dl>
          {balance > 0 ? (
            <SelectField
              label="Settle with"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </SelectField>
          ) : null}
          {balance < 0 ? (
            <p className="m-0 rounded-control bg-warning-soft px-3.5 py-2.5 text-small font-semibold text-warning-strong">
              {canRefund
                ? "The guest has overpaid. The difference is refunded to their payments as part of check-out."
                : "The guest has overpaid. A manager or accountant must refund the difference before check-out."}
            </p>
          ) : null}
          <FormError message={error} />
        </div>
      )}
    </Dialog>
  );
}

function Row({
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
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`m-0 ${strong ? "font-bold" : ""} ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}
