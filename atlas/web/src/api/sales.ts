import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { formatEgp, formatEgpExact, toNumber } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { titleCase } from "@/lib/text";
import type { UnitDirectoryEntry } from "./properties";
import type { LeadRow } from "./crm";

// ---------- Reservations ----------

export type ReservationStatus = "active" | "expiring" | "expired" | "converted";

export interface ReservationRow {
  id: string;
  unitId: string;
  customerId: string;
  agentId: string;
  reservedAt: string;
  expiresAt: string;
  depositEgp: number;
  status: ReservationStatus;
}

export interface CreateReservationBody {
  unitId: string;
  customerId: string;
  agentId: string;
  holdDays?: number;
  depositEgp: number;
}

export function useReservations(status?: ReservationStatus) {
  return useQuery({
    queryKey: ["reservations", status ?? "all"],
    queryFn: () => apiFetch<ReservationRow[]>(`/realestate/reservations${toQueryString({ status })}`),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReservationBody) => apiFetch<ReservationRow>("/realestate/reservations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<ReservationRow>(`/realestate/reservations/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["units"] });
    },
  });
}

export interface ReservationView {
  unitId: string;
  unitLocation: string;
  customer: string;
  agent: string;
  reservedDate: string;
  expires: string;
  deposit: string;
  status: string;
}

function formatExpiry(expiresAt: string, status: ReservationStatus): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffDays = Math.round((expires.getTime() - now.getTime()) / 86_400_000);
  if (status === "expired" || diffDays < 0) return `expired ${formatDate(expires)}`;
  if (diffDays === 0) return `today · ${formatDate(expires)}`;
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"} · ${formatDate(expires)}`;
}

export function toReservationView(
  row: ReservationRow,
  unit: (id: string) => UnitDirectoryEntry | undefined,
  customerName: (id: string) => string,
  agentName: (id: string) => string,
): ReservationView {
  const u = unit(row.unitId);
  return {
    unitId: u?.code ?? row.unitId,
    unitLocation: u?.location ?? "—",
    customer: customerName(row.customerId),
    agent: agentName(row.agentId),
    reservedDate: formatDate(row.reservedAt),
    expires: formatExpiry(row.expiresAt, row.status),
    deposit: formatEgpExact(row.depositEgp),
    status: titleCase(row.status),
  };
}

// ---------- Deals (leads with dealsOnly=true — see the consolidated lead/deal data model) ----------

export interface DealView {
  id: string;
  customer: string;
  unit: string;
  value: string;
  stage: string;
  probabilityPct: number;
  expectedClose: string;
  agent: string;
}

/** A "deal" is a lead past the `dealsOnly=true` filter — see the consolidated lead/deal/pipeline
 *  data model (no separate deals table). `customer` here is really the lead's own name: a deal is
 *  a prospect being tracked toward close, not yet a converted `Customer` record. */
export function toDealView(row: LeadRow, unit: (id: string) => UnitDirectoryEntry | undefined, agentName: (id: string) => string): DealView {
  const u = row.interestUnitId ? unit(row.interestUnitId) : undefined;
  return {
    id: row.id,
    customer: row.name,
    unit: u ? `${u.code} · ${u.location.split(" · ")[0]}` : row.interestText ?? "—",
    value: formatEgp(row.valueEgp),
    stage: titleCase(row.stage),
    probabilityPct: Math.round(toNumber(row.probabilityPct)),
    expectedClose: row.expectedCloseDate ? formatDate(row.expectedCloseDate) : "—",
    agent: agentName(row.agentId),
  };
}

// ---------- Contracts ----------

export type ContractStatus = "draft" | "awaiting-approval" | "signed";

export interface ContractRow {
  id: string;
  reservationId: string | null;
  customerId: string;
  unitId: string;
  valueEgp: number;
  signedDate: string | null;
  status: ContractStatus;
  createdAt: string;
}

export interface CreateContractBody {
  reservationId?: string | null;
  customerId: string;
  unitId: string;
  valueEgp: number;
}

export function useContracts(status?: ContractStatus) {
  return useQuery({
    queryKey: ["contracts", status ?? "all"],
    queryFn: () => apiFetch<ContractRow[]>(`/realestate/contracts${toQueryString({ status })}`),
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContractBody) => apiFetch<ContractRow>("/realestate/contracts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useSignContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<ContractRow>(`/realestate/contracts/${id}/sign`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export interface ContractView {
  id: string;
  customer: string;
  unit: string;
  value: string;
  signed: string;
  status: string;
}

export function toContractView(row: ContractRow, unit: (id: string) => UnitDirectoryEntry | undefined, customerName: (id: string) => string): ContractView {
  const u = unit(row.unitId);
  return {
    id: row.id,
    customer: customerName(row.customerId),
    unit: u ? `${u.code} · ${u.location.split(" · ")[0]}` : row.unitId,
    value: formatEgp(row.valueEgp),
    signed: row.signedDate ? formatDate(row.signedDate) : "—",
    status: titleCase(row.status),
  };
}

// ---------- Commissions ----------

export type CommissionStatus = "pending" | "approved" | "paid";

export interface CommissionRow {
  id: string;
  agentId: string;
  period: string;
  contractsCount: number;
  salesValueEgp: number;
  ratePct: string;
  commissionEgp: number;
  status: CommissionStatus;
}

export function useCommissions(agentId?: string) {
  return useQuery({
    queryKey: ["commissions", agentId ?? "all"],
    queryFn: () => apiFetch<CommissionRow[]>(`/realestate/commissions${toQueryString({ agentId })}`),
  });
}

export function useUpdateCommissionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommissionStatus }) =>
      apiFetch<CommissionRow>(`/realestate/commissions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
  });
}

export interface CommissionView {
  id: string;
  agent: string;
  period: string;
  contracts: number;
  salesValue: string;
  rate: string;
  commission: string;
  status: string;
}

export function toCommissionView(row: CommissionRow, agentName: (id: string) => string): CommissionView {
  return {
    id: row.id,
    agent: agentName(row.agentId),
    period: new Date(row.period).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    contracts: row.contractsCount,
    salesValue: formatEgp(row.salesValueEgp),
    rate: `${toNumber(row.ratePct).toFixed(1)}%`,
    commission: formatEgp(row.commissionEgp),
    status: titleCase(row.status),
  };
}

// ---------- Payment plans ----------

export type Cadence = "monthly" | "quarterly" | "semi-annual" | "annual";

export interface PaymentPlanRow {
  id: string;
  contractId: string;
  unitId: string;
  customerId: string;
  totalEgp: number;
  downPaymentPct: string;
  installmentCount: number;
  cadence: Cadence;
  startDate: string;
}

export interface InstallmentRow {
  id: string;
  paymentPlanId: string;
  seqNo: number;
  label: string;
  dueDate: string;
  amountEgp: number;
  paidEgp: number;
  status: "pending" | "partial" | "paid" | "overdue";
}

export function usePaymentPlans() {
  return useQuery({ queryKey: ["payment-plans"], queryFn: () => apiFetch<PaymentPlanRow[]>("/realestate/payment-plans") });
}

export function usePaymentPlan(id: string | undefined) {
  return useQuery({
    queryKey: ["payment-plans", id],
    queryFn: () => apiFetch<PaymentPlanRow & { installments: InstallmentRow[] }>(`/realestate/payment-plans/${id}`),
    enabled: !!id,
  });
}
