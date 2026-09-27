import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  METHOD_LABEL,
  newIdempotencyKey,
  useRefund,
  useVoidInvoice,
  type Folio,
} from "@/api/billing";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField, TextAreaField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatEgp } from "@/lib/format";

/**
 * Refund an overpayment (design gap, filled in the payment dialog's language). The amount is
 * capped at the folio's credit — the server enforces the same rule and never refunds more than
 * was paid on a payment. With "any payment" the server returns it newest-first.
 */
export function RefundDialog({
  reservationId,
  folio,
  onClose,
}: {
  reservationId: string;
  folio: Folio;
  onClose: () => void;
}) {
  const refund = useRefund(reservationId);
  const toast = useToast();
  const refundable = folio.payments.filter((p) => p.status === "completed" && p.refundable > 0);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState(String(folio.credit));
  const [reason, setReason] = useState("");
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const cap = paymentId
    ? Math.min(folio.credit, refundable.find((p) => p.id === paymentId)?.refundable ?? 0)
    : folio.credit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!(value > 0) || value > cap) {
      setError(`Enter an amount between 0.01 and ${formatEgp(cap)}.`);
      return;
    }
    if (reason.trim().length < 3) {
      setError("Give a reason for the refund.");
      return;
    }
    try {
      const { items } = await refund.mutateAsync({
        amount: value,
        reason: reason.trim(),
        paymentId: paymentId || null,
        idempotencyKey: key,
      });
      const failed = items.find((f) => f.status === "failed");
      if (failed) {
        setError(`Refund declined: ${failed.failureReason ?? "no reason given"}.`);
        return;
      }
      toast(`${formatEgp(value)} refunded`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Refund overpayment"
      description={`The guest is owed ${formatEgp(folio.credit)}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="refund-form" disabled={refund.isPending}>
            {refund.isPending ? "Processing…" : "Refund"}
          </Button>
        </>
      }
    >
      <form id="refund-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <SelectField
          label="Refund to"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
        >
          <option value="">The most recent payments</option>
          {refundable.map((p) => (
            <option key={p.id} value={p.id}>
              {METHOD_LABEL[p.method]} · {formatEgp(p.amount)} (up to {formatEgp(p.refundable)})
            </option>
          ))}
        </SelectField>
        <InputField
          label="Amount (EGP)"
          type="number"
          min={0.01}
          max={cap}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextAreaField
          label="Reason"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

/** Void an issued invoice with a reason; the folio can then be corrected and re-invoiced. */
export function VoidInvoiceDialog({
  invoiceId,
  number,
  reservationId,
  onClose,
}: {
  invoiceId: string;
  number: string;
  reservationId: string;
  onClose: () => void;
}) {
  const voidInvoice = useVoidInvoice(reservationId);
  const toast = useToast();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open
      title={`Void ${number}`}
      description="The invoice stays on record, marked void. Its charges can then be corrected and a new invoice issued."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={reason.trim().length < 3 || voidInvoice.isPending}
            onClick={() =>
              voidInvoice.mutate(
                { invoiceId, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast(`${number} voided`);
                    onClose();
                    navigate(`/reservations/${reservationId}`);
                  },
                },
              )
            }
          >
            Void Invoice
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextAreaField
          label="Reason"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormError message={voidInvoice.error ? errorMessage(voidInvoice.error) : null} />
      </div>
    </Dialog>
  );
}
