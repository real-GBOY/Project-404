import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@/lib/format";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { FormField } from "@/components/forms/form-field";
import { useMatterFormOptions } from "@/features/matters/hooks/use-matters";
import { billingKeys, listInvoices, type Invoice } from "../api/billing.api";
import { useBillingMutations } from "../hooks/use-billing";

const METHODS = ["bank_transfer", "cheque", "cash", "card"] as const;

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** when opened from an invoice detail */
  invoice?: Invoice;
}) {
  const { t } = useTranslation("billing");
  const { recordPayment } = useBillingMutations();
  const openInvoices = useQuery({
    queryKey: billingKeys.invoices("sent"),
    queryFn: ({ signal }) => listInvoices("sent", signal),
    enabled: open && !invoice,
  });

  const [invoiceId, setInvoiceId] = useState<string | null>(invoice?.id ?? null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("bank_transfer");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected =
    invoice ??
    openInvoices.data?.items.find((i) => i.id === invoiceId) ??
    null;
  const currency = invoice?.currency ?? selected?.currency ?? "EGP";
  const balance = invoice?.totals.balance ?? ("balance" in (selected ?? {}) ? (selected as { balance: number }).balance : undefined);

  useEffect(() => {
    if (open && invoice) {
      setInvoiceId(invoice.id);
      setAmount(String(invoice.totals.balance));
    }
  }, [open, invoice]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("payment.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          {error && (
            <div role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-[12px] font-medium text-danger">
              {error}
            </div>
          )}
          {!invoice && (
            <FormField label={t("payment.invoice")}>
              <Combobox
                options={(openInvoices.data?.items ?? []).map((i) => ({
                  value: i.id,
                  label: `${i.number} — ${i.clientName}`,
                  hint: formatMoney({ currency: i.currency, amount: String(i.balance) }),
                }))}
                value={invoiceId}
                onValueChange={setInvoiceId}
                placeholder={t("payment.pick_invoice")}
              />
            </FormField>
          )}

          {balance != null && (
            <p className="text-[12px] text-muted">
              {t("payment.balance", { amount: formatMoney({ currency, amount: String(balance) }) })}
            </p>
          )}

          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <FormField label={t("payment.amount")}>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
            <FormField label={t("payment.currency")}>
              <Input value={currency} disabled />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("payment.method")}>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label={t("payment.method")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`method.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("payment.reference")}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            loading={recordPayment.isPending}
            disabled={!invoiceId || !amount}
            onClick={async () => {
              setError(null);
              try {
                await recordPayment.mutateAsync({
                  invoiceId: invoiceId!,
                  amount: Number(amount),
                  currency,
                  method,
                  reference: reference || undefined,
                });
                setAmount("");
                setReference("");
                onOpenChange(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("payment.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORIES = ["Court fees", "Experts", "Disbursement", "Travel", "Subscriptions", "Other"];

export function RecordExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("billing");
  const options = useMatterFormOptions();
  const { recordExpense } = useBillingMutations();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [matterId, setMatterId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("expense.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          <FormField label={t("expense.description")}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("expense.category")}>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label={t("expense.category")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("expense.matter")}>
              <Combobox
                options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                value={matterId}
                onValueChange={setMatterId}
                placeholder={t("expense.matter_none")}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <FormField label={t("expense.amount")}>
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label={t("payment.currency")}>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger aria-label={t("payment.currency")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["EGP", "AED", "USD", "SAR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            loading={recordExpense.isPending}
            disabled={!description || !amount}
            onClick={async () => {
              await recordExpense.mutateAsync({
                description,
                category,
                amount: Number(amount),
                currency,
                matterId,
              });
              setDescription("");
              setAmount("");
              onOpenChange(false);
            }}
          >
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
