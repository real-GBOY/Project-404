import { useTranslation } from "react-i18next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { InvoiceStatus } from "../api/billing.api";

const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  issued: "info",
  sent: "warning",
  paid: "success",
  void: "danger",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation("billing");
  return (
    <Badge tone={INVOICE_TONE[status]} size="sm">
      {t(`invoice_status.${status}`)}
    </Badge>
  );
}

const EXPENSE_TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;

export function ExpenseStatusBadge({ status }: { status: keyof typeof EXPENSE_TONE }) {
  const { t } = useTranslation("billing");
  return (
    <Badge tone={EXPENSE_TONE[status]} size="sm">
      {t(`expense_status.${status}`)}
    </Badge>
  );
}
