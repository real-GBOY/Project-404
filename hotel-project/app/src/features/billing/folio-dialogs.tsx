import { useState, type FormEvent } from "react";
import {
  EXTRA_KINDS,
  METHOD_LABEL,
  newIdempotencyKey,
  useCollectPayment,
  usePostCharge,
  type ChargeKind,
  type PaymentMethod,
} from "@/api/billing";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatEgp } from "@/lib/format";

/**
 * Take a payment against the outstanding balance. The amount can't exceed the balance (the server
 * enforces it too); the idempotency key is fixed while the dialog is open so a retry or
 * double-click can't charge twice.
 */
export function CollectPaymentDialog({
  reservationId,
  balance,
  onClose,
}: {
  reservationId: string;
  balance: number;
  onClose: () => void;
}) {
  const collect = useCollectPayment(reservationId);
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState(String(balance));
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!(value > 0) || value > balance) {
      setError(`Enter an amount between 0.01 and ${formatEgp(balance)}.`);
      return;
    }
    try {
      const payment = await collect.mutateAsync({ method, amount: value, idempotencyKey: key });
      if (payment.status === "failed") {
        setError(`Payment declined: ${payment.failureReason ?? "no reason given"}.`);
        return;
      }
      toast(`${formatEgp(value)} received by ${METHOD_LABEL[method].toLowerCase()}`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Collect payment"
      description={`Outstanding balance ${formatEgp(balance)}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="payment-form" disabled={collect.isPending}>
            {collect.isPending ? "Processing…" : "Take payment"}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Amount (EGP)"
            type="number"
            min={0.01}
            max={balance}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

/** Post an extra to an in-house guest's folio. VAT is added by the server at the current rate. */
export function PostChargeDialog({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const post = usePostCharge(reservationId);
  const toast = useToast();
  const [kind, setKind] = useState<Exclude<ChargeKind, "room">>("breakfast");
  const [description, setDescription] = useState("Breakfast buffet");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post.mutateAsync({
        kind,
        description: description.trim(),
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
      });
      toast(`${description.trim()} added to the folio`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Add a charge"
      description="Posted to today's folio. VAT is added automatically."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="charge-form" disabled={post.isPending}>
            Add charge
          </Button>
        </>
      }
    >
      <form id="charge-form" onSubmit={submit} className="flex flex-col gap-4">
        <SelectField
          label="Type"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as Exclude<ChargeKind, "room">;
            setKind(next);
            setDescription(EXTRA_KINDS.find((k) => k.kind === next)!.label);
          }}
        >
          {EXTRA_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Quantity"
            type="number"
            min={1}
            max={100}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <InputField
            label="Unit price (EGP)"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
