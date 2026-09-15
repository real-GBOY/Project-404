import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { TableConfigResult, TableQueryParams } from "@/features/shared/table-types";
import { titleCase } from "@/lib/text";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useCustomers } from "@/api/crm";
import { useUnitDirectory, useProjectDirectory } from "@/api/properties";
import { pastDateBucket, futureDateBucket } from "@/lib/date-bucket";
import {
  usePayments,
  useRecordPayment,
  toPaymentView,
  useInstallments,
  toInstallmentView,
  useCollections,
  toCollectionView,
  useOutstanding,
  toOutstandingView,
  useFinancialReports,
  useCreateFinancialReport,
  toFinancialReportView,
  type PaymentView,
  type PaymentMethod,
  type PaymentStatus,
  type InstallmentView,
  type InstallmentStatus,
  type CollectionView,
  type OutstandingView,
  type FinancialReportView,
  type ReportType,
  type ReportStatus,
  type ReportSchedule,
} from "@/api/finance";

/**
 * Table configs for: payments, installments, collections, outstanding, finreports.
 * Plain `.ts` (no JSX) — cell renderers are invoked as functions, not JSX tags.
 */

const PAYMENT_METHODS: PaymentMethod[] = ["bank-transfer", "cheque", "cash", "card"];
const PAYMENT_STATUSES: PaymentStatus[] = ["paid", "pending", "overdue"];
const INSTALLMENT_STATUSES: InstallmentStatus[] = ["pending", "partial", "paid", "overdue"];
const AGING_BANDS = ["0-30", "31-60", "61-90", "90+"];
const REPORT_STATUSES: ReportStatus[] = ["draft", "active"];

/** Distinct values actually present across the full (unfiltered) dataset —
 *  legitimate for a field with no fixed enum, computed from the *unfiltered*
 *  query so it never shrinks as a filter narrows `rows`. */
function distinctOptions<T>(rows: T[], get: (r: T) => string): Array<{ value: string; label: string }> {
  return Array.from(new Set(rows.map(get))).sort().map((v) => ({ value: v, label: v }));
}

// ---------- Payments ----------

const paymentColumns: DataColumn<PaymentView>[] = [
  { key: "reference", label: "Reference", width: 96, render: (p) => TextCell({ value: p.reference, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (p) => TextCell({ value: p.customer }) },
  { key: "unit", label: "Unit", width: 92, render: (p) => TextCell({ value: p.unit, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 108, align: "end", render: (p) => TextCell({ value: p.amount, mono: true }) },
  { key: "method", label: "Method", flex: 0.9, render: (p) => TextCell({ value: p.method, weight: "normal" }) },
  { key: "date", label: "Date", width: 96, render: (p) => TextCell({ value: p.date, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 92, render: (p) => BadgeCell({ status: p.status }) },
];

/** Buckets a collection-rate percentage into real, meaningful bands — a plain
 *  distinct-value filter over a percentage would offer one option per row. */
function collectionRateBand(pct: number): string {
  if (pct >= 95) return "95%+";
  if (pct >= 80) return "80-94%";
  if (pct >= 50) return "50-79%";
  return "Below 50%";
}

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "bank-transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

export function usePaymentsTableConfig(params: TableQueryParams): TableConfigResult<PaymentView> {
  const filtered = usePayments({
    method: params.filters.method as PaymentMethod | undefined,
    status: params.filters.status as PaymentStatus | undefined,
    q: params.q,
  });
  const all = usePayments();
  const units = useUnitDirectory();
  const customers = useCustomers();
  const record = useRecordPayment();

  if (filtered.isLoading || all.isLoading || units.isLoading || customers.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || units.error || customers.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? units.error ?? customers.error };
  }

  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const toView = (r: NonNullable<typeof filtered.data>[number]) => toPaymentView(r, (id) => units.byId.get(id), (id) => customersById.get(id) ?? id);
  // Date has no fixed backend column (it's a derived recency bucket), so it's
  // filtered client-side over the already backend-narrowed (method/status/q) rows.
  const dateBucket = params.filters.date;
  const rows = filtered.data!.map(toView).filter((r) => !dateBucket || pastDateBucket(r.paidAt) === dateBucket);
  const allRows = all.data!.map(toView);
  const clearedCount = allRows.filter((r) => r.status === "Paid").length;
  const collectedEgp = all.data!.filter((r) => r.status === "paid").reduce((s, r) => s + r.amountEgp, 0);
  const dateOptions = distinctOptions(allRows, (r) => pastDateBucket(r.paidAt));

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Payments",
      subtitle: `${allRows.length} payments recorded`,
      primaryAction: "Record Payment",
      columns: paymentColumns,
      rows,
      rowKey: (p) => p.id,
      searchPlaceholder: "Search reference, customer, unit…",
      kpis: [
        { label: "Total collected", value: `EGP ${(collectedEgp / 1e6).toFixed(1)}M` },
        { label: "Cleared", value: String(clearedCount) },
        { label: "Total payments", value: String(allRows.length) },
      ],
      filters: [
        { label: "Method", param: "method", options: PAYMENT_METHODS.map((m) => PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)!) },
        { label: "Status", param: "status", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
        { label: "Date", param: "date", options: dateOptions },
      ],
      minWidth: 800,
      emptyWhy: "Payments are recorded against a customer's installment schedule as they clear the bank, cheque or payment gateway — adjust filters or the date range to see other transactions.",
      emptyTitle: "No payments match this filter",
      createForm: {
        title: "Record Payment",
        submitLabel: "Record Payment",
        fields: [
          { name: "customerId", label: "Customer", type: "select", required: true, options: (customers.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { name: "unitId", label: "Unit", type: "select", required: true, options: [...units.byId.entries()].map(([id, u]) => ({ value: id, label: `${u.code} · ${u.location}` })) },
          { name: "amountEgp", label: "Amount (EGP)", type: "number", required: true, placeholder: "290000" },
          { name: "method", label: "Method", type: "select", required: true, defaultValue: "bank-transfer", options: PAYMENT_METHOD_OPTIONS },
        ],
        onSubmit: async (values) => {
          await record.mutateAsync({
            customerId: values.customerId,
            unitId: values.unitId,
            amountEgp: Number(values.amountEgp),
            method: values.method as PaymentMethod,
          });
        },
      },
    },
  };
}

// ---------- Installments ----------

const installmentColumns: DataColumn<InstallmentView>[] = [
  { key: "label", label: "Installment", width: 92, render: (i) => TextCell({ value: i.label, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.1, render: (i) => TextCell({ value: i.customer }) },
  { key: "unit", label: "Unit", width: 92, render: (i) => TextCell({ value: i.unit, mono: true, weight: "normal" }) },
  { key: "dueDate", label: "Due date", width: 100, render: (i) => TextCell({ value: i.dueDate, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 108, align: "end", render: (i) => TextCell({ value: i.amount, mono: true }) },
  { key: "paid", label: "Paid", width: 108, align: "end", render: (i) => TextCell({ value: i.paid, mono: true, weight: "normal" }) },
  { key: "progress", label: "Progress", width: 100, render: (i) => BarCell({ pct: i.progressPct, label: `${i.progressPct}%` }) },
  { key: "status", label: "Status", width: 92, render: (i) => BadgeCell({ status: i.status }) },
];

export function useInstallmentsTableConfig(params: TableQueryParams): TableConfigResult<InstallmentView> {
  const filtered = useInstallments({
    status: params.filters.status as InstallmentStatus | undefined,
    projectId: params.filters.projectId,
    q: params.q,
  });
  const all = useInstallments();
  const units = useUnitDirectory();
  const customers = useCustomers();
  const projects = useProjectDirectory();

  if (filtered.isLoading || all.isLoading || units.isLoading || customers.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || units.error || customers.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? units.error ?? customers.error };
  }

  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const toView = (r: NonNullable<typeof filtered.data>[number]) => toInstallmentView(r, (id) => units.byId.get(id), (id) => customersById.get(id) ?? id);
  // Due-date bucket has no fixed backend column, so filtered client-side over
  // the already backend-narrowed (status/project/q) rows.
  const dueBucket = params.filters.dueDate;
  const rows = filtered.data!.map(toView).filter((r) => !dueBucket || futureDateBucket(r.dueDateIso) === dueBucket);
  const allRows = all.data!.map(toView);
  const overdueEgp = all.data!.filter((r) => r.status === "overdue").reduce((s, r) => s + (r.amountEgp - r.paidEgp), 0);
  const paidEgp = all.data!.reduce((s, r) => s + r.paidEgp, 0);
  const dueOptions = distinctOptions(allRows, (r) => futureDateBucket(r.dueDateIso));

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Installments",
      subtitle: `${allRows.length} scheduled installment lines across active payment plans`,
      columns: installmentColumns,
      rows,
      rowKey: (i) => i.id,
      searchPlaceholder: "Search customer, unit, installment…",
      kpis: [
        { label: "Overdue", value: `EGP ${(overdueEgp / 1e6).toFixed(1)}M` },
        { label: "Paid to date", value: `EGP ${(paidEgp / 1e6).toFixed(1)}M` },
        { label: "Total lines", value: String(allRows.length) },
      ],
      filters: [
        { label: "Status", param: "status", options: INSTALLMENT_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
        { label: "Project", param: "projectId", options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
        { label: "Due date", param: "dueDate", options: dueOptions },
      ],
      minWidth: 820,
      emptyWhy: "Installment lines are generated from each customer's payment plan the moment a contract is signed — clear filters to see installments across all plans.",
      emptyTitle: "No installments match this filter",
    },
  };
}

// ---------- Collections ----------

const collectionColumns: DataColumn<CollectionView>[] = [
  { key: "project", label: "Project", flex: 1.3, render: (c) => TextCell({ value: c.project }) },
  { key: "due", label: "Due", width: 104, align: "end", render: (c) => TextCell({ value: c.due, mono: true }) },
  { key: "collected", label: "Collected", width: 104, align: "end", render: (c) => TextCell({ value: c.collected, mono: true }) },
  { key: "overdue", label: "Overdue", width: 100, align: "end", render: (c) => TextCell({ value: c.overdue, mono: true, weight: "normal" }) },
  { key: "accounts", label: "Accounts", width: 80, align: "end", render: (c) => TextCell({ value: String(c.accounts), mono: true, weight: "normal" }) },
  { key: "rate", label: "Collection rate", width: 128, render: (c) => BarCell({ pct: c.collectionRatePct, label: `${c.collectionRatePct}%` }) },
];

export function useCollectionsTableConfig(params: TableQueryParams): TableConfigResult<CollectionView> {
  const filtered = useCollections({ projectId: params.filters.project });
  const all = useCollections();
  const projects = useProjectDirectory();

  if (filtered.isLoading || all.isLoading || projects.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || projects.error) return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? projects.error };

  const toView = (r: NonNullable<typeof filtered.data>[number]) => toCollectionView(r, (id) => projects.byId.get(id) ?? id);
  // Collections is a small per-project aggregate (one row per project), so the
  // rate band and free text are filtered client-side over the already
  // backend-narrowed (project) rows — same justified exception as Availability.
  const rateBand = params.filters.rate;
  const q = params.q?.trim().toLowerCase();
  const rows = filtered.data!.map(toView).filter((r) => (!rateBand || collectionRateBand(r.collectionRatePct) === rateBand) && (!q || r.project.toLowerCase().includes(q)));
  const dueEgp = all.data!.reduce((s, r) => s + r.dueEgp, 0);
  const collectedEgp = all.data!.reduce((s, r) => s + r.collectedEgp, 0);
  const overdueEgp = all.data!.reduce((s, r) => s + r.overdueEgp, 0);
  const accounts = all.data!.reduce((s, r) => s + r.accounts, 0);
  const rate = dueEgp > 0 ? Math.round((collectedEgp / dueEgp) * 1000) / 10 : 0;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Collections",
      subtitle: "Collections performance by project for the current period",
      columns: collectionColumns,
      rows,
      rowKey: (c) => c.project,
      searchPlaceholder: "Search project…",
      kpis: [
        { label: "Collected", value: `EGP ${(collectedEgp / 1e6).toFixed(1)}M` },
        { label: "Due", value: `EGP ${(dueEgp / 1e6).toFixed(1)}M` },
        { label: "Collection rate", value: `${rate.toFixed(1)}%` },
        { label: "Overdue", value: `EGP ${(overdueEgp / 1e6).toFixed(1)}M` },
        { label: "Accounts in arrears", value: String(accounts) },
      ],
      filters: [
        { label: "Project", param: "project", options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
        {
          label: "Collection rate",
          param: "rate",
          options: ["95%+", "80-94%", "50-79%", "Below 50%"].map((v) => ({ value: v, label: v })),
        },
      ],
      minWidth: 760,
      emptyWhy: "Collections roll up due, collected and overdue amounts per project for the current period — clear filters to see every project's performance.",
      emptyTitle: "No collections match this filter",
    },
  };
}

// ---------- Outstanding ----------

const outstandingColumns: DataColumn<OutstandingView>[] = [
  { key: "customer", label: "Customer", flex: 1.2, render: (o) => TextCell({ value: o.customer, sub: o.customerId }) },
  { key: "unit", label: "Unit", width: 92, render: (o) => TextCell({ value: o.unit, mono: true, weight: "normal" }) },
  { key: "overdue", label: "Overdue", width: 108, align: "end", render: (o) => TextCell({ value: o.overdue, mono: true }) },
  { key: "aging", label: "Aging", width: 92, render: (o) => BadgeCell({ status: o.aging }) },
  { key: "agingDays", label: "Days", width: 64, align: "end", render: (o) => TextCell({ value: `${o.agingDays}d`, mono: true, weight: "normal" }) },
  { key: "exposure", label: "Exposure", width: 108, render: (o) => BarCell({ pct: o.exposurePct, label: `${o.exposurePct}%` }) },
  { key: "agent", label: "Agent", flex: 0.9, render: (o) => TextCell({ value: o.agent, weight: "normal" }) },
];

export function useOutstandingTableConfig(params: TableQueryParams): TableConfigResult<OutstandingView> {
  const filtered = useOutstanding({ agentId: params.filters.agentId, projectId: params.filters.projectId });
  const all = useOutstanding();
  const units = useUnitDirectory();
  const customers = useCustomers();
  const team = useTeamDirectory();
  const projects = useProjectDirectory();

  if (filtered.isLoading || all.isLoading || units.isLoading || customers.isLoading || team.isLoading) {
    return { config: undefined, isLoading: true, error: null };
  }
  if (filtered.error || all.error || units.error || customers.error || team.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? units.error ?? customers.error ?? team.error };
  }

  const customersById = new Map((customers.data ?? []).map((c) => [c.id, { name: c.name, agentId: c.agentId, portfolioEgp: c.portfolioEgp }]));
  const toView = (r: NonNullable<typeof filtered.data>[number]) =>
    toOutstandingView(r, (id) => units.byId.get(id), (id) => customersById.get(id), (id) => team.byId.get(id) ?? id);
  // Aging band and free text have no fixed backend column (aging is derived
  // from today's date; text spans resolved customer/unit/agent names), so
  // they're filtered client-side over the already backend-narrowed rows.
  const aging = params.filters.aging;
  const q = params.q?.trim().toLowerCase();
  const rows = filtered.data!.map(toView).filter((r) => (!aging || r.aging === aging) && (!q || `${r.customer} ${r.customerId} ${r.unit} ${r.agent}`.toLowerCase().includes(q)));
  const totalOverdueEgp = all.data!.reduce((s, r) => s + r.overdueEgp, 0);
  const over90Egp = all.data!.filter((r) => r.agingDays > 90).reduce((s, r) => s + r.overdueEgp, 0);
  const accounts = new Set(all.data!.map((r) => r.customerId)).size;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Outstanding Payments",
      subtitle: "Overdue balances prioritised by aging and exposure",
      columns: outstandingColumns,
      rows,
      rowKey: (o) => o.id,
      onRowClick: (row) => `/customers/${row.customerId}`,
      searchPlaceholder: "Search customer, unit, agent…",
      kpis: [
        { label: "Total overdue", value: `EGP ${(totalOverdueEgp / 1e6).toFixed(1)}M` },
        { label: "90+ days", value: `EGP ${(over90Egp / 1e6).toFixed(1)}M` },
        { label: "Accounts", value: String(accounts) },
      ],
      filters: [
        { label: "Aging", param: "aging", options: AGING_BANDS.map((b) => ({ value: b, label: b })) },
        { label: "Agent", param: "agentId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        { label: "Project", param: "projectId", options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
      ],
      minWidth: 880,
      emptyWhy: "Outstanding accounts are overdue installment balances prioritised by aging and exposure — clear filters to see accounts across all agents and projects.",
      emptyTitle: "No outstanding accounts match this filter",
    },
  };
}

// ---------- Financial reports ----------

const finreportColumns: DataColumn<FinancialReportView>[] = [
  { key: "name", label: "Report", flex: 1.6, render: (r) => TextCell({ value: r.name, sub: r.period }) },
  { key: "type", label: "Type", width: 108, render: (r) => BadgeCell({ status: r.type }) },
  { key: "owner", label: "Owner", flex: 0.9, render: (r) => TextCell({ value: r.owner, weight: "normal" }) },
  { key: "schedule", label: "Schedule", width: 108, render: (r) => TextCell({ value: r.schedule, mono: true, weight: "normal" }) },
  { key: "lastRun", label: "Last run", width: 100, render: (r) => TextCell({ value: r.lastRun, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 84, render: (r) => BadgeCell({ status: r.status }) },
];

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "collections", label: "Collections" },
  { value: "revenue", label: "Revenue" },
  { value: "receivables", label: "Receivables" },
  { value: "commissions", label: "Commissions" },
  { value: "treasury", label: "Treasury" },
];

const REPORT_SCHEDULE_OPTIONS: { value: ReportSchedule; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function useFinreportsTableConfig(params: TableQueryParams): TableConfigResult<FinancialReportView> {
  const filtered = useFinancialReports({
    type: params.filters.type as ReportType | undefined,
    status: params.filters.status as ReportStatus | undefined,
    q: params.q,
  });
  const all = useFinancialReports();
  const team = useTeamDirectory();
  const createReport = useCreateFinancialReport();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || team.error) return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error };

  // Owner is resolved via the org's team directory, not a joinable column in
  // this schema, so it's filtered client-side (by raw ownerId, before the
  // name resolution below) over the already backend-narrowed rows.
  const ownerId = params.filters.owner;
  const scoped = ownerId ? filtered.data!.filter((r) => r.ownerId === ownerId) : filtered.data!;
  const rows = scoped.map((r) => toFinancialReportView(r, (id) => team.byId.get(id) ?? id));
  const allRows = all.data!.map((r) => toFinancialReportView(r, (id) => team.byId.get(id) ?? id));
  const scheduledCount = allRows.filter((r) => r.schedule !== "Manual").length;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Financial Reports",
      subtitle: "Scheduled and ad-hoc finance reporting",
      primaryAction: "Generate Report",
      columns: finreportColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search reports…",
      kpis: [
        { label: "Saved reports", value: String(allRows.length) },
        { label: "Scheduled", value: String(scheduledCount) },
      ],
      filters: [
        { label: "Type", param: "type", options: REPORT_TYPE_OPTIONS },
        { label: "Owner", param: "owner", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        { label: "Status", param: "status", options: REPORT_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
      ],
      minWidth: 760,
      emptyWhy: "Saved and scheduled finance reports live here — create a new report or clear filters to see reports of other types.",
      emptyTitle: "No reports match this filter",
      createForm: {
        title: "Generate Report",
        submitLabel: "Create Report",
        fields: [
          { name: "name", label: "Name", required: true, placeholder: "e.g. Q2-26 Collections Summary" },
          { name: "type", label: "Type", type: "select", required: true, defaultValue: "collections", options: REPORT_TYPE_OPTIONS },
          { name: "period", label: "Period", required: true, placeholder: "e.g. Q2 2026" },
          { name: "schedule", label: "Schedule", type: "select", defaultValue: "manual", options: REPORT_SCHEDULE_OPTIONS },
          { name: "ownerId", label: "Owner", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        ],
        onSubmit: async (values) => {
          await createReport.mutateAsync({
            name: values.name,
            type: values.type as ReportType,
            period: values.period,
            ownerId: values.ownerId,
            schedule: values.schedule as ReportSchedule,
          });
        },
      },
    },
  };
}
