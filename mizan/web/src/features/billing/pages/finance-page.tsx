import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatMoney } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { DataTable, type Column } from "@/components/tables/data-table";
import { useExpenses, useInvoices, usePayments, useBillingMutations } from "../hooks/use-billing";
import { RecordExpenseDialog, RecordPaymentDialog } from "../components/record-dialogs";
import { ExpenseStatusBadge, InvoiceStatusBadge } from "../components/billing-badges";
import type { ExpenseListItem, InvoiceListItem, PaymentListItem } from "../api/billing.api";

const TABS = ["invoices", "payments", "expenses"] as const;

function InvoicesTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const status = useUrlParams<"status">({});
  const query = useInvoices(status.get("status"));

  const columns: Column<InvoiceListItem>[] = [
    {
      id: "number",
      header: t("columns.invoice"),
      cell: (i) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{i.number}</span>
            <InvoiceStatusBadge status={i.status} />
          </div>
          <span className="text-[11.5px] text-muted">
            {i.clientName}
            {i.matterTitle ? ` · ${i.matterTitle}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "issuedAt",
      header: t("columns.issued"),
      cell: (i) => (i.issuedAt ? formatDate(i.issuedAt) : "—"),
      hideBelow: "md",
      align: "end",
    },
    {
      id: "total",
      header: t("columns.total"),
      cell: (i) => (
        <span className="tabular-nums">{formatMoney({ currency: i.currency, amount: String(i.total) })}</span>
      ),
      align: "end",
    },
    {
      id: "balance",
      header: t("columns.balance"),
      cell: (i) =>
        i.balance > 0 ? (
          <span className="font-semibold tabular-nums text-warning">
            {formatMoney({ currency: i.currency, amount: String(i.balance) })}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
      align: "end",
      hideBelow: "sm",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Select
          value={status.get("status") ?? "all"}
          onValueChange={(v) => status.set({ status: v === "all" ? undefined : v })}
        >
          <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[8.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common:all")}</SelectItem>
            {(["draft", "issued", "sent", "paid", "void"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`invoice_status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can("create:invoice") && (
          <Button icon="add" variant="secondary" disabled>
            {t("actions.new_invoice")}
          </Button>
        )}
      </div>
      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="request_quote" title={t("empty.invoices")} />}
      >
        {(data) => (
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(i) => i.id}
            onRowClick={(i) => navigate(`/billing/invoices/${i.id}`)}
          />
        )}
      </QueryBoundary>
    </div>
  );
}

function PaymentsTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const query = usePayments();
  const [recording, setRecording] = useState(false);

  const columns: Column<PaymentListItem>[] = [
    {
      id: "invoice",
      header: t("columns.invoice"),
      cell: (p) => (
        <div>
          <Link to={`/billing/invoices/${p.invoiceId}`} className="font-semibold text-link hover:underline">
            {p.invoiceNumber}
          </Link>
          <div className="text-[11.5px] text-muted">{p.clientName}</div>
        </div>
      ),
    },
    { id: "method", header: t("columns.method"), cell: (p) => t(`method.${p.method}`), hideBelow: "md" },
    {
      id: "receivedAt",
      header: t("columns.received"),
      cell: (p) => formatDate(p.receivedAt),
      hideBelow: "sm",
      align: "end",
    },
    {
      id: "amount",
      header: t("columns.amount"),
      cell: (p) => (
        <span className="font-semibold tabular-nums text-success">
          {formatMoney({ currency: p.currency, amount: String(p.amount) })}
        </span>
      ),
      align: "end",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {can("record:payment") && (
        <div className="flex justify-end">
          <Button icon="add" onClick={() => setRecording(true)}>
            {t("actions.record_payment")}
          </Button>
        </div>
      )}
      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={5} />}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="payments" title={t("empty.payments")} />}
      >
        {(data) => <DataTable columns={columns} rows={data.items} rowKey={(p) => p.id} />}
      </QueryBoundary>
      <RecordPaymentDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

function ExpensesTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const status = useUrlParams<"estatus">({});
  const query = useExpenses(status.get("estatus"));
  const { approveExpense } = useBillingMutations();
  const [recording, setRecording] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Select
          value={status.get("estatus") ?? "all"}
          onValueChange={(v) => status.set({ estatus: v === "all" ? undefined : v })}
        >
          <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[9rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common:all")}</SelectItem>
            {(["pending", "approved", "rejected"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`expense_status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can("create:expense") && (
          <Button icon="add" onClick={() => setRecording(true)}>
            {t("actions.record_expense")}
          </Button>
        )}
      </div>
      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={5} />}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon="receipt" title={t("empty.expenses")} />}
      >
        {(data) => (
          <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
            {data.items.map((e: ExpenseListItem) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-foreground">{e.description}</div>
                  <div className="text-[11.5px] text-muted">
                    {e.category}
                    {e.matterTitle ? ` · ${e.matterTitle}` : ""} · {e.submittedBy}
                  </div>
                </div>
                <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
                  {formatMoney({ currency: e.currency, amount: String(e.amount) })}
                </span>
                <ExpenseStatusBadge status={e.status} />
                {e.status === "pending" && can("approve:expense") && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="check"
                    onClick={() => approveExpense.mutate(e.id)}
                  >
                    {t("actions.approve")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
      <RecordExpenseDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

export function FinancePage() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const params = useUrlParams<"tab">({ tab: "invoices" });
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as (typeof TABS)[number])
    : "invoices";

  const PERM: Record<(typeof TABS)[number], string> = {
    invoices: "read:invoice",
    payments: "read:payment",
    expenses: "read:expense",
  };
  const visible = TABS.filter((name) => can(PERM[name]));

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs value={tab} onValueChange={(v) => params.set({ tab: v === "invoices" ? undefined : v })}>
        <TabsList>
          {visible.map((name) => (
            <TabsTrigger key={name} value={name}>
              <Icon
                name={name === "invoices" ? "receipt_long" : name === "payments" ? "payments" : "receipt"}
                size={14}
                className="me-1"
              />
              {t(`tabs.${name}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
