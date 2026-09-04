import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, formatMoneyList } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Pill, type PillTone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { MatterChip } from "@/components/ui/matter-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  ListToolbar,
  ToolbarButton,
} from "@/components/tables/list-card";
import { downloadCsv, exportStamp } from "@/lib/export";
import { useExpenses, useInvoices, usePayments, useBillingMutations } from "../hooks/use-billing";
import {
  NewInvoiceDialog,
  RecordExpenseDialog,
  RecordPaymentDialog,
} from "../components/record-dialogs";
import type {
  ExpenseListItem,
  FinanceSummary,
  InvoiceListItem,
  InvoiceStatus,
  Money,
  PaymentListItem,
} from "../api/billing.api";

const TABS = ["invoices", "payments", "expenses"] as const;
type Tab = (typeof TABS)[number];
const PERM: Record<Tab, string> = {
  invoices: "read:invoice",
  payments: "read:payment",
  expenses: "read:expense",
};
const ICON: Record<Tab, string> = {
  invoices: "receipt_long",
  payments: "payments",
  expenses: "account_balance_wallet",
};

const INVOICE_TONE: Record<InvoiceStatus, PillTone> = {
  draft: "gray",
  issued: "blue",
  sent: "blue",
  paid: "green",
  void: "gray",
};
const EXPENSE_TONE: Record<string, PillTone> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

function moneyOrText(v: Money[] | string | undefined): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return v.length ? formatMoneyList(v).join(" · ") : "—";
}

function useFinanceSummary(tab: Tab) {
  return useQuery({
    queryKey: ["finance", "summary", tab],
    queryFn: ({ signal }) =>
      httpClient<FinanceSummary>("/finance/summary", { query: { tab }, signal }),
  });
}

function FinanceKpis({ tab }: { tab: Tab }) {
  const { t } = useTranslation("billing");
  const q = useFinanceSummary(tab);
  const s = q.data;
  const KEYS: Record<Tab, [string, string, string, string]> = {
    invoices: ["kpi_inv.billed", "kpi_inv.collected", "kpi_inv.outstanding", "kpi_inv.unbilled"],
    payments: ["kpi_pay.received", "kpi_pay.pending", "kpi_pay.avg_days", "kpi_pay.retainer"],
    expenses: ["kpi_exp.disbursements", "kpi_exp.recoverable", "kpi_exp.pending", "kpi_exp.overheads"],
  };
  const [k1, k2, k3, k4] = KEYS[tab];
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <StatCard label={t(k1)} value={s ? moneyOrText(s.a) : "—"} />
      <StatCard label={t(k2)} value={s ? moneyOrText(s.b) : "—"} valueTone="muted" />
      <StatCard
        label={t(k3)}
        value={s ? moneyOrText(s.c) : "—"}
        valueTone={tab === "invoices" ? "danger" : tab === "expenses" ? "warning" : "default"}
        sub={
          tab === "invoices" && s?.overdue
            ? t("kpi_inv.overdue", { count: s.overdue })
            : undefined
        }
        subTone="danger"
      />
      <StatCard label={t(k4)} value={s ? moneyOrText(s.d) : "—"} />
    </div>
  );
}

function exportInvoices(items: InvoiceListItem[]) {
  downloadCsv(
    `mizan-invoices-${exportStamp()}`,
    [
      { key: "number", header: "Invoice" },
      { key: "clientName", header: "Client" },
      { key: "matterReference", header: "Matter" },
      { key: "status", header: "Status" },
      { key: "currency", header: "Currency" },
      { key: "total", header: "Total" },
      { key: "balance", header: "Balance" },
      { key: "issuedAt", header: "Issued" },
      { key: "dueAt", header: "Due" },
    ],
    items,
  );
}

function InvoicesTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"status">({});
  const query = useInvoices(params.get("status"));
  const [creating, setCreating] = useState(false);

  const columns = [
    { key: "no", label: t("columns.invoice"), width: 150 },
    { key: "client", label: t("columns.client"), flex: 1 },
    { key: "matter", label: t("columns.matter"), width: 110 },
    { key: "issued", label: t("columns.issued"), width: 110 },
    { key: "due", label: t("columns.due"), width: 110 },
    { key: "amount", label: t("columns.amount"), width: 130 },
    { key: "status", label: t("columns.status"), width: 120 },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <FinanceKpis tab="invoices" />
      <ListCard>
        <ListToolbar>
          <span className="text-[14px] font-extrabold text-foreground">{t("tabs.invoices")}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Select
              value={params.get("status") ?? "all"}
              onValueChange={(v) => params.set({ status: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common:all")}</SelectItem>
                {(["draft", "issued", "sent", "paid", "void"] as const).map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(`invoice_status.${st}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToolbarButton
              icon="download"
              disabled={!query.data?.items.length}
              onClick={() => query.data && exportInvoices(query.data.items)}
            >
              {t("export")}
            </ToolbarButton>
            {can("create:invoice") && (
              <Button size="sm" icon="add" onClick={() => setCreating(true)}>
                {t("actions.new_invoice")}
              </Button>
            )}
          </div>
        </ListToolbar>
        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={6} />}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon="receipt_long" title={t("empty.invoices")} />}
        >
          {(data) => (
            <>
              <ColumnHeader columns={[...columns]} />
              {data.items.map((i) => (
                <ListRow key={i.id} onClick={() => navigate(`/billing/invoices/${i.id}`)}>
                  <Cell col={columns[0]} className="font-mono font-extrabold text-link">
                    {i.number}
                  </Cell>
                  <Cell col={columns[1]} className="truncate text-[13px] font-bold text-foreground">
                    {i.clientName}
                  </Cell>
                  <Cell col={columns[2]}>
                    {i.matterReference ? <MatterChip>{i.matterReference}</MatterChip> : "—"}
                  </Cell>
                  <Cell col={columns[3]}>
                    {i.issuedAt ? formatDate(i.issuedAt, { day: "numeric", month: "short" }) : "—"}
                  </Cell>
                  <Cell col={columns[4]}>
                    {i.dueAt ? formatDate(i.dueAt, { day: "numeric", month: "short" }) : "—"}
                  </Cell>
                  <Cell col={columns[5]} className="text-[13px] font-extrabold text-foreground">
                    {formatMoney({ currency: i.currency, amount: String(i.total) })}
                  </Cell>
                  <Cell col={columns[6]}>
                    <Pill tone={INVOICE_TONE[i.status]}>{t(`invoice_status.${i.status}`)}</Pill>
                  </Cell>
                </ListRow>
              ))}
            </>
          )}
        </QueryBoundary>
      </ListCard>
      <NewInvoiceDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function exportPayments(items: PaymentListItem[]) {
  downloadCsv(
    `mizan-payments-${exportStamp()}`,
    [
      { key: "reference", header: "Receipt" },
      { key: "clientName", header: "Client" },
      { key: "invoiceNumber", header: "Invoice" },
      { key: "receivedAt", header: "Date" },
      { key: "method", header: "Method" },
      { key: "currency", header: "Currency" },
      { key: "amount", header: "Amount" },
    ],
    items,
  );
}

function PaymentsTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const query = usePayments();
  const [recording, setRecording] = useState(false);

  const columns = [
    { key: "ref", label: t("columns.receipt"), width: 150 },
    { key: "client", label: t("columns.client"), flex: 1 },
    { key: "against", label: t("columns.against"), width: 150 },
    { key: "date", label: t("columns.date"), width: 120 },
    { key: "method", label: t("columns.method"), width: 150 },
    { key: "amount", label: t("columns.amount"), width: 130 },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <FinanceKpis tab="payments" />
      <ListCard>
        <ListToolbar>
          <span className="text-[14px] font-extrabold text-foreground">{t("tabs.payments")}</span>
          <div className="ms-auto flex items-center gap-2">
            <ToolbarButton
              icon="download"
              disabled={!query.data?.items.length}
              onClick={() => query.data && exportPayments(query.data.items)}
            >
              {t("export")}
            </ToolbarButton>
            {can("record:payment") && (
              <Button size="sm" icon="add" onClick={() => setRecording(true)}>
                {t("actions.record_payment")}
              </Button>
            )}
          </div>
        </ListToolbar>
        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={5} />}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon="payments" title={t("empty.payments")} />}
        >
          {(data) => (
            <>
              <ColumnHeader columns={[...columns]} />
              {data.items.map((p) => (
                <ListRow key={p.id} onClick={() => navigate(`/billing/invoices/${p.invoiceId}`)}>
                  <Cell col={columns[0]} className="font-extrabold text-link">
                    {p.reference ?? "—"}
                  </Cell>
                  <Cell col={columns[1]} className="truncate text-[13px] font-bold text-foreground">
                    {p.clientName}
                  </Cell>
                  <Cell col={columns[2]} className="truncate">
                    {p.invoiceNumber}
                  </Cell>
                  <Cell col={columns[3]}>
                    {formatDate(p.receivedAt, { day: "numeric", month: "short", year: "numeric" })}
                  </Cell>
                  <Cell col={columns[4]} className="truncate">
                    {t(`method.${p.method}`, { defaultValue: p.method })}
                  </Cell>
                  <Cell col={columns[5]} className="text-[13px] font-extrabold text-foreground">
                    {formatMoney({ currency: p.currency, amount: String(p.amount) })}
                  </Cell>
                </ListRow>
              ))}
            </>
          )}
        </QueryBoundary>
      </ListCard>
      <RecordPaymentDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

function ExpensesTab() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const params = useUrlParams<"estatus">({});
  const query = useExpenses(params.get("estatus"));
  const { approveExpense } = useBillingMutations();
  const [recording, setRecording] = useState(false);

  const columns = [
    { key: "ref", label: t("columns.ref"), width: 110 },
    { key: "desc", label: t("columns.description"), flex: 1 },
    { key: "matter", label: t("columns.matter"), width: 110 },
    { key: "date", label: t("columns.date"), width: 120 },
    { key: "by", label: t("columns.submitted"), width: 150 },
    { key: "amount", label: t("columns.amount"), width: 120 },
    { key: "status", label: t("columns.status"), width: 150 },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <FinanceKpis tab="expenses" />
      <ListCard>
        <ListToolbar>
          <span className="text-[14px] font-extrabold text-foreground">{t("tabs.expenses")}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Select
              value={params.get("estatus") ?? "all"}
              onValueChange={(v) => params.set({ estatus: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label={t("columns.status")} className="h-9 w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common:all")}</SelectItem>
                {(["pending", "approved", "rejected"] as const).map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(`expense_status.${st}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("record:expense") && (
              <Button size="sm" icon="add" onClick={() => setRecording(true)}>
                {t("actions.record_expense")}
              </Button>
            )}
          </div>
        </ListToolbar>
        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={5} />}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState icon="account_balance_wallet" title={t("empty.expenses")} />}
        >
          {(data) => (
            <>
              <ColumnHeader columns={[...columns]} />
              {data.items.map((e: ExpenseListItem) => (
                <ListRow key={e.id}>
                  <Cell col={columns[0]} className="font-extrabold text-link">
                    {e.reference}
                  </Cell>
                  <Cell col={columns[1]} className="truncate text-[13px] font-bold text-foreground">
                    {e.description}
                  </Cell>
                  <Cell col={columns[2]}>
                    {e.matterReference ? <MatterChip>{e.matterReference}</MatterChip> : "—"}
                  </Cell>
                  <Cell col={columns[3]}>
                    {formatDate(e.incurredAt, { day: "numeric", month: "short", year: "numeric" })}
                  </Cell>
                  <Cell col={columns[4]} className="truncate">
                    {e.submittedBy ?? "—"}
                  </Cell>
                  <Cell col={columns[5]} className="text-[13px] font-extrabold text-foreground">
                    {formatMoney({ currency: e.currency, amount: String(e.amount) })}
                  </Cell>
                  <Cell col={columns[6]} className="flex items-center gap-1.5">
                    <Pill tone={EXPENSE_TONE[e.status]}>{t(`expense_status.${e.status}`)}</Pill>
                    {e.status === "pending" && can("approve:expense") && (
                      <button
                        type="button"
                        onClick={() => approveExpense.mutate(e.id)}
                        className="text-[11px] font-bold text-link hover:underline"
                      >
                        {t("actions.approve")}
                      </button>
                    )}
                  </Cell>
                </ListRow>
              ))}
            </>
          )}
        </QueryBoundary>
      </ListCard>
      <RecordExpenseDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}

export function FinancePage() {
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const params = useUrlParams<"tab">({ tab: "invoices" });
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as Tab)
    : "invoices";

  useSetPageChrome({ title: t("title") });

  const visible = TABS.filter((name) => can(PERM[name]));

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center gap-2.5" role="tablist" aria-label={t("title")}>
        <div className="flex gap-[3px] rounded-group bg-surface-sand-hover p-1">
          {visible.map((name) => {
            const active = name === tab;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => params.set({ tab: name === "invoices" ? undefined : name })}
                className={cn(
                  "flex items-center gap-[7px] rounded-lg px-[15px] py-2 text-[13px] transition-colors",
                  active
                    ? "bg-surface font-extrabold text-primary shadow-tab-warm"
                    : "font-semibold text-warm-ink hover:bg-surface-warm-2",
                )}
              >
                <Icon name={ICON[name]} size={18} />
                {t(`tabs.${name}`)}
              </button>
            );
          })}
        </div>
        <span className="ms-1.5 text-[12.5px] font-medium text-muted-2">{t(`hint.${tab}`)}</span>
      </div>

      {tab === "invoices" ? (
        <InvoicesTab />
      ) : tab === "payments" ? (
        <PaymentsTab />
      ) : (
        <ExpensesTab />
      )}
    </PageContainer>
  );
}
