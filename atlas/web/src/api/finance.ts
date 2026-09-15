import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ENDPOINTS } from "@/config";
import { formatEgp, formatEgpExact } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { titleCase } from "@/lib/text";
import type { UnitDirectoryEntry } from "./properties";

// ---------- Payments ----------

export type PaymentMethod = "bank-transfer" | "cheque" | "cash" | "card";
export type PaymentStatus = "paid" | "pending" | "overdue";

export interface PaymentRow {
  id: string;
  reference: string;
  customerId: string;
  unitId: string;
  installmentId: string | null;
  amountEgp: number;
  method: PaymentMethod;
  paidAt: string;
  status: PaymentStatus;
}

export interface RecordPaymentBody {
  customerId: string;
  unitId: string;
  installmentId?: string | null;
  amountEgp: number;
  method: PaymentMethod;
}

export function usePayments(customerId?: string) {
  return useQuery({
    queryKey: ["payments", customerId ?? "all"],
    queryFn: () => get<PaymentRow[]>(ENDPOINTS.payments.list, { customerId }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordPaymentBody) => post<PaymentRow>(ENDPOINTS.payments.list, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["outstanding"] });
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
    },
  });
}

export interface PaymentView {
  reference: string;
  customer: string;
  unit: string;
  amount: string;
  method: string;
  date: string;
  status: string;
}

export function toPaymentView(row: PaymentRow, unit: (id: string) => UnitDirectoryEntry | undefined, customerName: (id: string) => string): PaymentView {
  return {
    reference: row.reference,
    customer: customerName(row.customerId),
    unit: unit(row.unitId)?.code ?? row.unitId,
    amount: formatEgpExact(row.amountEgp),
    method: titleCase(row.method),
    date: formatDate(row.paidAt),
    status: titleCase(row.status),
  };
}

// ---------- Installments ----------

export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue";

export interface InstallmentRow {
  id: string;
  paymentPlanId: string;
  seqNo: number;
  label: string;
  dueDate: string;
  amountEgp: number;
  paidEgp: number;
  status: InstallmentStatus;
  customerId: string;
  unitId: string;
}

export function useInstallments(status?: InstallmentStatus) {
  return useQuery({
    queryKey: ["installments", status ?? "all"],
    queryFn: () => get<InstallmentRow[]>(ENDPOINTS.installments.list, { status }),
  });
}

export interface InstallmentView {
  id: string;
  label: string;
  customer: string;
  unit: string;
  dueDate: string;
  amount: string;
  paid: string;
  progressPct: number;
  status: string;
}

export function toInstallmentView(row: InstallmentRow, unit: (id: string) => UnitDirectoryEntry | undefined, customerName: (id: string) => string): InstallmentView {
  return {
    id: row.id,
    label: row.label,
    customer: customerName(row.customerId),
    unit: unit(row.unitId)?.code ?? row.unitId,
    dueDate: formatDate(row.dueDate),
    amount: formatEgpExact(row.amountEgp),
    paid: formatEgpExact(row.paidEgp),
    progressPct: row.amountEgp > 0 ? Math.round((row.paidEgp / row.amountEgp) * 100) : 0,
    status: titleCase(row.status),
  };
}

// ---------- Collections (read-composition over installments, grouped by project) ----------

export interface CollectionRow {
  projectId: string;
  dueEgp: number;
  collectedEgp: number;
  overdueEgp: number;
  accounts: number;
  collectionRatePct: number;
}

export function useCollections() {
  return useQuery({ queryKey: ["collections"], queryFn: () => get<CollectionRow[]>(ENDPOINTS.payments.collections) });
}

export interface CollectionView {
  project: string;
  due: string;
  collected: string;
  overdue: string;
  accounts: number;
  collectionRatePct: number;
}

export function toCollectionView(row: CollectionRow, projectName: (id: string) => string): CollectionView {
  return {
    project: projectName(row.projectId),
    due: formatEgp(row.dueEgp),
    collected: formatEgp(row.collectedEgp),
    overdue: formatEgp(row.overdueEgp),
    accounts: row.accounts,
    collectionRatePct: Math.round(row.collectionRatePct),
  };
}

// ---------- Outstanding (read-composition over overdue/pending installments past due) ----------

export interface OutstandingRow {
  customerId: string;
  unitId: string;
  overdueEgp: number;
  agingDays: number;
  dueDate: string;
}

export function useOutstanding() {
  return useQuery({ queryKey: ["outstanding"], queryFn: () => get<OutstandingRow[]>(ENDPOINTS.payments.outstanding) });
}

export interface OutstandingView {
  customerId: string;
  customer: string;
  unit: string;
  overdue: string;
  aging: string;
  agingDays: number;
  exposurePct: number;
  agent: string;
}

function agingBand(days: number): string {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function toOutstandingView(
  row: OutstandingRow,
  unit: (id: string) => UnitDirectoryEntry | undefined,
  customer: (id: string) => { name: string; agentId: string; portfolioEgp: number } | undefined,
  agentName: (id: string) => string,
): OutstandingView {
  const c = customer(row.customerId);
  return {
    customerId: row.customerId,
    customer: c?.name ?? row.customerId,
    unit: unit(row.unitId)?.code ?? row.unitId,
    overdue: formatEgpExact(row.overdueEgp),
    aging: agingBand(row.agingDays),
    agingDays: row.agingDays,
    exposurePct: c && c.portfolioEgp > 0 ? Math.min(100, Math.round((row.overdueEgp / c.portfolioEgp) * 100)) : 0,
    agent: c ? agentName(c.agentId) : "—",
  };
}

// ---------- Financial reports ----------

export type ReportType = "collections" | "revenue" | "receivables" | "commissions" | "treasury";
export type ReportSchedule = "manual" | "daily" | "weekly" | "monthly";
export type ReportStatus = "draft" | "active";

export interface FinancialReportRow {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  ownerId: string;
  schedule: ReportSchedule;
  lastRunAt: string | null;
  status: ReportStatus;
}

export interface CreateFinancialReportBody {
  name: string;
  type: ReportType;
  period: string;
  ownerId: string;
  schedule?: ReportSchedule;
}

export function useFinancialReports() {
  return useQuery({ queryKey: ["financial-reports"], queryFn: () => get<FinancialReportRow[]>(ENDPOINTS.financialReports.list) });
}

export function useCreateFinancialReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFinancialReportBody) => post<FinancialReportRow>(ENDPOINTS.financialReports.list, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial-reports"] }),
  });
}

export interface FinancialReportView {
  id: string;
  name: string;
  period: string;
  type: string;
  owner: string;
  schedule: string;
  lastRun: string;
  status: string;
}

export function toFinancialReportView(row: FinancialReportRow, ownerName: (id: string) => string): FinancialReportView {
  return {
    id: row.id,
    name: row.name,
    period: row.period,
    type: titleCase(row.type),
    owner: ownerName(row.ownerId),
    schedule: titleCase(row.schedule),
    lastRun: row.lastRunAt ? formatDate(row.lastRunAt) : "Never",
    status: titleCase(row.status),
  };
}
