import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Icon } from "@/components/ui/icon";
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

const CURRENCIES = ["EGP", "AED", "USD", "SAR"] as const;
type DraftLine = { kind: "fee" | "disbursement"; description: string; amount: string };

export function NewInvoiceDialog({
  open,
  onOpenChange,
  clientId,
  matterId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId?: string;
  matterId?: string;
}) {
  const { t } = useTranslation("billing");
  const navigate = useNavigate();
  const options = useMatterFormOptions();
  const { createInvoice } = useBillingMutations();

  const [client, setClient] = useState<string | null>(clientId ?? null);
  const [matter, setMatter] = useState<string | null>(matterId ?? null);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("EGP");
  const [vatPct, setVatPct] = useState("14");
  const [lines, setLines] = useState<DraftLine[]>([{ kind: "fee", description: "", amount: "" }]);

  useEffect(() => {
    if (open) {
      setClient(clientId ?? null);
      setMatter(matterId ?? null);
      setCurrency("EGP");
      setVatPct("14");
      setLines([{ kind: "fee", description: "", amount: "" }]);
    }
  }, [open, clientId, matterId]);

  const validLines = lines.filter((l) => l.description.trim() && Number(l.amount) > 0);
  const subtotal = validLines.reduce((s, l) => s + Number(l.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("actions.new_invoice")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("columns.client")}>
              <Combobox
                options={(options.data?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
                value={client}
                onValueChange={setClient}
                placeholder={t("payment.pick_invoice", { defaultValue: "Select a client" })}
              />
            </FormField>
            <FormField label={t("columns.matter")}>
              <Combobox
                options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                value={matter}
                onValueChange={setMatter}
                placeholder={t("expense.matter_none")}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-[8rem_8rem] gap-3">
            <FormField label={t("payment.currency")}>
              <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
                <SelectTrigger aria-label={t("payment.currency")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("totals.vat", { defaultValue: "VAT %" })}>
              <Input
                type="number"
                inputMode="decimal"
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value)}
              />
            </FormField>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-secondary">
              {t("totals.fees", { defaultValue: "Line items" })}
            </span>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[7rem_1fr_6rem_2rem] items-center gap-2">
                <Select
                  value={l.kind}
                  onValueChange={(v) =>
                    setLines((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, kind: v as DraftLine["kind"] } : x)),
                    )
                  }
                >
                  <SelectTrigger aria-label={t("columns.description")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee">{t("line_kind.fee", { defaultValue: "Fee" })}</SelectItem>
                    <SelectItem value="disbursement">
                      {t("line_kind.disbursement", { defaultValue: "Disbursement" })}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={l.description}
                  placeholder={t("columns.description")}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={l.amount}
                  placeholder="0"
                  onChange={(e) =>
                    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  aria-label={t("common:actions.delete")}
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  className="flex size-8 items-center justify-center rounded-md border border-border-control text-muted hover:bg-surface-subtle disabled:opacity-40"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, { kind: "fee", description: "", amount: "" }])}
              className="self-start text-[12px] font-bold text-link hover:underline"
            >
              + {t("actions.add_line", { defaultValue: "Add line" })}
            </button>
          </div>

          {subtotal > 0 && (
            <p className="text-[12px] text-muted">
              {t("totals.subtotal", { defaultValue: "Subtotal" })}:{" "}
              {formatMoney({ currency, amount: String(subtotal) })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            loading={createInvoice.isPending}
            disabled={!client}
            onClick={async () => {
              const created = await createInvoice.mutateAsync({
                clientId: client!,
                matterId: matter,
                currency,
                vatRate: Number(vatPct) > 0 ? Number(vatPct) / 100 : undefined,
                lines: validLines.map((l) => ({
                  kind: l.kind,
                  description: l.description.trim(),
                  amount: Number(l.amount),
                })),
              });
              onOpenChange(false);
              if (created?.id) navigate(`/billing/invoices/${created.id}`);
            }}
          >
            {t("common:actions.create")}
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
