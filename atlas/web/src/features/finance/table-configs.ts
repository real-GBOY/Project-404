import type { TableConfigRegistry } from "@/features/shared/table-types";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import { PAYMENTS, type PaymentFixture } from "@/mocks/fixtures/payments";
import { INSTALLMENTS, type InstallmentFixture } from "@/mocks/fixtures/installments";
import { COLLECTIONS, type CollectionFixture } from "@/mocks/fixtures/collections";
import { OUTSTANDING, type OutstandingAccountFixture } from "@/mocks/fixtures/outstanding";
import { FINANCIAL_REPORTS, type FinancialReportFixture } from "@/mocks/fixtures/financial-reports";

/**
 * Table configs for: payments, installments, collections, outstanding, finreports.
 * Plain `.ts` (no JSX) — cell renderers are invoked as functions, not JSX tags.
 */

/** "EGP 1,234,000" -> 1234000. Local to this file — no shared money-parsing lib exists yet. */
function egpToNumber(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// ---------- Payments ----------

const paymentColumns: DataColumn<PaymentFixture>[] = [
  { key: "reference", label: "Reference", width: 96, render: (p) => TextCell({ value: p.reference, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (p) => TextCell({ value: p.customer }) },
  { key: "unit", label: "Unit", width: 92, render: (p) => TextCell({ value: p.unit, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 108, align: "end", render: (p) => TextCell({ value: p.amount, mono: true }) },
  { key: "method", label: "Method", flex: 0.9, render: (p) => TextCell({ value: p.method, weight: "normal" }) },
  { key: "date", label: "Date", width: 96, render: (p) => TextCell({ value: p.date, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 92, render: (p) => BadgeCell({ status: p.status }) },
];

// ---------- Installments ----------

const installmentColumns: DataColumn<InstallmentFixture>[] = [
  { key: "label", label: "Installment", width: 92, render: (i) => TextCell({ value: i.label, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.1, render: (i) => TextCell({ value: i.customer }) },
  { key: "unit", label: "Unit", width: 92, render: (i) => TextCell({ value: i.unit, mono: true, weight: "normal" }) },
  { key: "dueDate", label: "Due date", width: 100, render: (i) => TextCell({ value: i.dueDate, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 108, align: "end", render: (i) => TextCell({ value: i.amount, mono: true }) },
  { key: "paid", label: "Paid", width: 108, align: "end", render: (i) => TextCell({ value: i.paid, mono: true, weight: "normal" }) },
  {
    key: "progress",
    label: "Progress",
    width: 100,
    render: (i) => {
      const amount = egpToNumber(i.amount);
      const paid = egpToNumber(i.paid);
      const pct = amount > 0 ? Math.round((paid / amount) * 100) : 0;
      return BarCell({ pct, label: `${pct}%` });
    },
  },
  { key: "status", label: "Status", width: 92, render: (i) => BadgeCell({ status: i.status }) },
];

// ---------- Collections ----------

const collectionColumns: DataColumn<CollectionFixture>[] = [
  { key: "project", label: "Project", flex: 1.3, render: (c) => TextCell({ value: c.project }) },
  { key: "due", label: "Due", width: 104, align: "end", render: (c) => TextCell({ value: c.due, mono: true }) },
  { key: "collected", label: "Collected", width: 104, align: "end", render: (c) => TextCell({ value: c.collected, mono: true }) },
  { key: "overdue", label: "Overdue", width: 100, align: "end", render: (c) => TextCell({ value: c.overdue, mono: true, weight: "normal" }) },
  { key: "accounts", label: "Accounts", width: 80, align: "end", render: (c) => TextCell({ value: String(c.accounts), mono: true, weight: "normal" }) },
  { key: "rate", label: "Collection rate", width: 128, render: (c) => BarCell({ pct: c.collectionRatePct, label: `${c.collectionRatePct}%` }) },
];

// ---------- Outstanding ----------

const outstandingColumns: DataColumn<OutstandingAccountFixture>[] = [
  { key: "customer", label: "Customer", flex: 1.2, render: (o) => TextCell({ value: o.customer, sub: o.customerId, mono: false }) },
  { key: "unit", label: "Unit", width: 92, render: (o) => TextCell({ value: o.unit, mono: true, weight: "normal" }) },
  { key: "overdue", label: "Overdue", width: 108, align: "end", render: (o) => TextCell({ value: o.overdue, mono: true }) },
  { key: "aging", label: "Aging", width: 92, render: (o) => BadgeCell({ status: o.aging }) },
  { key: "agingDays", label: "Days", width: 64, align: "end", render: (o) => TextCell({ value: `${o.agingDays}d`, mono: true, weight: "normal" }) },
  { key: "exposure", label: "Exposure", width: 108, render: (o) => BarCell({ pct: o.exposurePct, label: `${o.exposurePct}%` }) },
  { key: "lastContact", label: "Last contact", width: 100, render: (o) => TextCell({ value: o.lastContact, mono: true, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.9, render: (o) => TextCell({ value: o.agent, weight: "normal" }) },
];

// ---------- Financial reports ----------

const finreportColumns: DataColumn<FinancialReportFixture>[] = [
  { key: "name", label: "Report", flex: 1.6, render: (r) => TextCell({ value: r.name, sub: r.period }) },
  { key: "type", label: "Type", width: 108, render: (r) => BadgeCell({ status: r.type }) },
  { key: "owner", label: "Owner", flex: 0.9, render: (r) => TextCell({ value: r.owner, weight: "normal" }) },
  { key: "schedule", label: "Schedule", width: 108, render: (r) => TextCell({ value: r.schedule, mono: true, weight: "normal" }) },
  { key: "lastRun", label: "Last run", width: 100, render: (r) => TextCell({ value: r.lastRun, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 84, render: (r) => BadgeCell({ status: r.status }) },
];

export const financeTableConfigs: TableConfigRegistry = {
  payments: {
    title: "Payments",
    subtitle: "2,184 payments recorded · EGP 6.42B collected to date · 91.3% collection rate",
    primaryAction: "Record Payment",
    columns: paymentColumns,
    rows: PAYMENTS,
    rowKey: (p) => p.reference,
    searchText: (p) => `${p.reference} ${p.customer} ${p.unit} ${p.method}`,
    searchPlaceholder: "Search reference, customer, unit…",
    kpis: [
      { label: "Collected MTD", value: "EGP 412.8M", delta: "+11.2%", deltaSign: "up" },
      { label: "Cleared", value: "2,061" },
      { label: "Pending clearance", value: "84" },
      { label: "Failed / bounced", value: "39", delta: "+4", deltaSign: "down" },
    ],
    filters: ["Method: All", "Status: All", "Date range"],
    minWidth: 800,
    emptyWhy:
      "Payments are recorded against a customer's installment schedule as they clear the bank, cheque or payment gateway — adjust filters or the date range to see other transactions.",
    emptyTitle: "No payments match this filter",
  },

  installments: {
    title: "Installments",
    subtitle: "All scheduled installment lines across 312 active payment plans",
    primaryAction: "Record Payment",
    columns: installmentColumns,
    rows: INSTALLMENTS,
    rowKey: (i) => `${i.unit}_${i.label}`,
    searchText: (i) => `${i.label} ${i.customer} ${i.unit}`,
    searchPlaceholder: "Search customer, unit, installment…",
    kpis: [
      { label: "Due next 30d", value: "EGP 318.4M" },
      { label: "Overdue", value: "EGP 42.6M", delta: "+4.2%", deltaSign: "down" },
      { label: "Paid this quarter", value: "EGP 1.14B", delta: "+8.1%", deltaSign: "up" },
      { label: "Plans active", value: "312", delta: "+9", deltaSign: "up" },
    ],
    filters: ["Status: All", "Project: All", "Due date"],
    minWidth: 820,
    emptyWhy:
      "Installment lines are generated from each customer's payment plan the moment a contract is signed — clear filters to see installments across all plans.",
    emptyTitle: "No installments match this filter",
  },

  collections: {
    title: "Collections",
    subtitle: "Collections performance by project for the current period",
    primaryAction: "Send Reminders",
    columns: collectionColumns,
    rows: COLLECTIONS,
    rowKey: (c) => c.project,
    searchText: (c) => c.project,
    searchPlaceholder: "Search project…",
    kpis: [
      { label: "Collected MTD", value: "EGP 412.8M", delta: "+11.2%", deltaSign: "up" },
      { label: "Due MTD", value: "EGP 452.1M" },
      { label: "Collection rate", value: "91.3%", delta: "+1.8pp", deltaSign: "up" },
      { label: "Overdue", value: "EGP 42.6M", delta: "+4.2%", deltaSign: "down" },
      { label: "Accounts in arrears", value: "128", delta: "+11", deltaSign: "down" },
    ],
    filters: ["Project: All", "Collection rate"],
    minWidth: 760,
    emptyWhy:
      "Collections roll up due, collected and overdue amounts per project for the current period — clear filters to see every project's performance.",
    emptyTitle: "No collections match this filter",
  },

  outstanding: {
    title: "Outstanding Payments",
    subtitle: "Overdue balances prioritised by aging and exposure",
    primaryAction: "Send Reminder",
    columns: outstandingColumns,
    rows: OUTSTANDING,
    rowKey: (o) => o.customerId,
    onRowClick: (row) => `/customers/${row.customerId}`,
    searchText: (o) => `${o.customer} ${o.customerId} ${o.unit} ${o.agent}`,
    searchPlaceholder: "Search customer, unit, agent…",
    kpis: [
      { label: "Total overdue", value: "EGP 42.6M", delta: "+4.2%", deltaSign: "down" },
      { label: "90+ days", value: "EGP 14.2M", delta: "+2.1M", deltaSign: "down" },
      { label: "Accounts", value: "128", delta: "+11", deltaSign: "down" },
      { label: "Recovered 30d", value: "EGP 11.8M", delta: "+18%", deltaSign: "up" },
    ],
    filters: ["Aging: All", "Agent: All", "Project: All"],
    minWidth: 880,
    emptyWhy:
      "Outstanding accounts are overdue installment balances prioritised by aging and exposure — clear filters to see accounts across all agents and projects.",
    emptyTitle: "No outstanding accounts match this filter",
  },

  finreports: {
    title: "Financial Reports",
    subtitle: "Scheduled and ad-hoc finance reporting · exports to XLSX and PDF",
    primaryAction: "Generate Report",
    columns: finreportColumns,
    rows: FINANCIAL_REPORTS,
    rowKey: (r) => r.name,
    searchText: (r) => `${r.name} ${r.type} ${r.owner}`,
    searchPlaceholder: "Search reports…",
    kpis: [
      { label: "Saved reports", value: "24" },
      { label: "Scheduled", value: "11" },
      { label: "Runs this month", value: "86" },
      { label: "Failed runs", value: "0" },
    ],
    filters: ["Type: All", "Owner: All", "Status: All"],
    minWidth: 760,
    emptyWhy:
      "Saved and scheduled finance reports live here — create a new report or clear filters to see reports of other types.",
    emptyTitle: "No reports match this filter",
  },
};
