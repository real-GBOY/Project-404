import { createElement, type ReactNode } from "react";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { TableConfigResult } from "@/features/shared/table-types";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useCustomers, useLeads, useTrackAsDeal } from "@/api/crm";
import { useUnitDirectory } from "@/api/properties";
import {
  useReservations,
  useCreateReservation,
  toReservationView,
  useContracts,
  useCreateContract,
  toContractView,
  useCommissions,
  useUpdateCommissionStatus,
  toCommissionView,
  toDealView,
  type ReservationView,
  type DealView,
  type ContractView,
  type CommissionView,
} from "@/api/sales";

/**
 * Table configs for: reservations, deals, contracts, commissions.
 * Plain `.ts` (no JSX) — cell renderers are invoked as functions, not JSX tags.
 */

// ---------- Reservations ----------

function expirySub(r: ReservationView): ReactNode {
  if (r.status === "Expired") return createElement("span", { className: "font-mono font-semibold text-danger" }, r.expires);
  if (r.status === "Expiring") return createElement("span", { className: "font-mono font-semibold text-warning" }, r.expires);
  return r.expires;
}

const reservationColumns: DataColumn<ReservationView>[] = [
  { key: "unit", label: "Unit", width: 112, render: (r) => TextCell({ value: r.unitId, sub: r.unitLocation, mono: true }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (r) => TextCell({ value: r.customer }) },
  { key: "agent", label: "Agent", flex: 1, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "reserved", label: "Reserved", width: 150, render: (r) => TextCell({ value: r.reservedDate, sub: expirySub(r), mono: true }) },
  { key: "deposit", label: "Deposit", width: 104, align: "end", render: (r) => TextCell({ value: r.deposit, mono: true }) },
  { key: "status", label: "Status", width: 92, render: (r) => BadgeCell({ status: r.status }) },
];

export function useReservationsTableConfig(): TableConfigResult<ReservationView> {
  const { data, isLoading, error } = useReservations();
  const team = useTeamDirectory();
  const customers = useCustomers();
  const units = useUnitDirectory();
  const createReservation = useCreateReservation();
  const auth = useAuth();

  if (isLoading || team.isLoading || customers.isLoading || units.isLoading) return { config: undefined, isLoading: true, error: null };
  if (error || team.error || customers.error || units.error) return { config: undefined, isLoading: false, error: error ?? team.error ?? customers.error ?? units.error };

  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const rows = (data ?? []).map((r) => toReservationView(r, (id) => units.byId.get(id), (id) => customersById.get(id) ?? id, (id) => team.byId.get(id) ?? id));
  const activeCount = rows.filter((r) => r.status !== "Expired" && r.status !== "Converted").length;
  const expiringCount = rows.filter((r) => r.status === "Expiring").length;
  const totalDepositEgp = (data ?? []).reduce((s, r) => s + r.depositEgp, 0);
  const availableUnits = [...units.byId.entries()].filter(([, u]) => u.status === "available");

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Reservations",
      subtitle: `${activeCount} active reservations · ${expiringCount} expiring soon`,
      primaryAction: "New Reservation",
      columns: reservationColumns,
      rows,
      rowKey: (r) => r.unitId,
      searchText: (r) => `${r.customer} ${r.unitId} ${r.unitLocation} ${r.agent}`,
      searchPlaceholder: "Search unit, customer, agent…",
      kpis: [
        { label: "Active", value: String(activeCount) },
        { label: "Expiring soon", value: String(expiringCount) },
        { label: "Reserved value", value: totalDepositEgp > 0 ? `EGP ${(totalDepositEgp / 1e6).toFixed(1)}M` : "EGP 0" },
        { label: "Total", value: String(rows.length) },
      ],
      filters: ["Status: All", "Project: All", "Agent: All"],
      emptyWhy: "Reservations are logged automatically whenever an agent places a temporary hold on an available unit — clear filters or check back once a new hold is created.",
      emptyTitle: "No reservations match this filter",
      createForm: {
        title: "New Reservation",
        submitLabel: "Reserve Unit",
        fields: [
          { name: "unitId", label: "Unit", type: "select", required: true, options: availableUnits.map(([id, u]) => ({ value: id, label: `${u.code} · ${u.location}` })) },
          { name: "customerId", label: "Customer", type: "select", required: true, options: (customers.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { name: "depositEgp", label: "Deposit (EGP)", type: "number", required: true, placeholder: "150000" },
          { name: "holdDays", label: "Hold Days", type: "number", defaultValue: "14", placeholder: "14" },
          { name: "agentId", label: "Agent", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
        ],
        onSubmit: async (values) => {
          await createReservation.mutateAsync({
            unitId: values.unitId,
            customerId: values.customerId,
            agentId: values.agentId,
            depositEgp: Number(values.depositEgp),
            holdDays: values.holdDays ? Number(values.holdDays) : undefined,
          });
        },
      },
    },
  };
}

// ---------- Deals (leads with dealsOnly=true) ----------

const dealColumns: DataColumn<DealView>[] = [
  { key: "id", label: "Deal", width: 76, render: (d) => TextCell({ value: d.id, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (d) => TextCell({ value: d.customer }) },
  { key: "unit", label: "Unit", flex: 1.3, render: (d) => TextCell({ value: d.unit, weight: "normal" }) },
  { key: "value", label: "Value", width: 92, align: "end", render: (d) => TextCell({ value: d.value, mono: true }) },
  { key: "stage", label: "Stage", width: 104, render: (d) => BadgeCell({ status: d.stage }) },
  { key: "probability", label: "Probability", width: 112, render: (d) => BarCell({ pct: d.probabilityPct, label: `${d.probabilityPct}%` }) },
  { key: "close", label: "Expected close", width: 104, render: (d) => TextCell({ value: d.expectedClose, mono: true, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.9, render: (d) => TextCell({ value: d.agent, weight: "normal" }) },
];

export function useDealsTableConfig(): TableConfigResult<DealView> {
  const deals = useLeads({ dealsOnly: true });
  const allLeads = useLeads();
  const team = useTeamDirectory();
  const units = useUnitDirectory();
  const trackAsDeal = useTrackAsDeal();

  if (deals.isLoading || allLeads.isLoading || team.isLoading || units.isLoading) return { config: undefined, isLoading: true, error: null };
  if (deals.error || allLeads.error || team.error || units.error) return { config: undefined, isLoading: false, error: deals.error ?? allLeads.error ?? team.error ?? units.error };

  const rows = (deals.data ?? []).map((r) => toDealView(r, (id) => units.byId.get(id), (id) => team.byId.get(id) ?? id));
  const openRows = rows.filter((r) => r.stage !== "Lost" && r.stage !== "Sold");
  const pipelineValueEgp = (deals.data ?? []).reduce((s, r) => s + r.valueEgp, 0);
  const weightedEgp = (deals.data ?? []).reduce((s, r) => s + r.valueEgp * ((Number(r.probabilityPct) || 0) / 100), 0);
  const dealIds = new Set((deals.data ?? []).map((d) => d.id));
  const candidateLeads = (allLeads.data ?? []).filter((l) => !dealIds.has(l.id));

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Deals",
      subtitle: `${openRows.length} open deals · EGP ${(weightedEgp / 1e6).toFixed(1)}M weighted pipeline`,
      primaryAction: "Track as Deal",
      columns: dealColumns,
      rows,
      rowKey: (d) => d.id,
      searchText: (d) => `${d.customer} ${d.id} ${d.unit} ${d.agent}`,
      searchPlaceholder: "Search deal, customer, unit…",
      kpis: [
        { label: "Open deals", value: String(openRows.length) },
        { label: "Pipeline value", value: `EGP ${(pipelineValueEgp / 1e9).toFixed(2)}B` },
        { label: "Weighted pipeline", value: `EGP ${(weightedEgp / 1e6).toFixed(1)}M` },
        { label: "Avg. deal value", value: rows.length ? `EGP ${(pipelineValueEgp / rows.length / 1e6).toFixed(1)}M` : "EGP 0" },
      ],
      filters: ["Stage: All", "Agent: All", "Expected close"],
      minWidth: 800,
      emptyWhy: "Deals open the moment a qualified lead is tracked with a close probability and expected date — clear the stage or agent filter to see deals elsewhere in the pipeline.",
      emptyTitle: "No deals match this filter",
      createForm: {
        title: "Track as Deal",
        description: "Promote an existing lead onto the Deals pipeline by setting a close probability and expected close date.",
        submitLabel: "Track as Deal",
        fields: [
          { name: "leadId", label: "Lead", type: "select", required: true, options: candidateLeads.map((l) => ({ value: l.id, label: `${l.name} (${l.id})` })) },
          { name: "probabilityPct", label: "Probability %", type: "number", required: true, placeholder: "70" },
          { name: "expectedCloseDate", label: "Expected Close", type: "date", required: true },
        ],
        onSubmit: async (values) => {
          await trackAsDeal.mutateAsync({ id: values.leadId, probabilityPct: Number(values.probabilityPct), expectedCloseDate: values.expectedCloseDate });
        },
      },
    },
  };
}

// ---------- Contracts ----------

const contractColumns: DataColumn<ContractView>[] = [
  { key: "id", label: "Contract", width: 84, render: (c) => TextCell({ value: c.id, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (c) => TextCell({ value: c.customer }) },
  { key: "unit", label: "Unit", flex: 1.3, render: (c) => TextCell({ value: c.unit, weight: "normal" }) },
  { key: "value", label: "Value", width: 96, align: "end", render: (c) => TextCell({ value: c.value, mono: true }) },
  { key: "signed", label: "Signed", width: 100, render: (c) => TextCell({ value: c.signed, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 132, render: (c) => BadgeCell({ status: c.status }) },
];

export function useContractsTableConfig(): TableConfigResult<ContractView> {
  const { data, isLoading, error } = useContracts();
  const customers = useCustomers();
  const units = useUnitDirectory();
  const createContract = useCreateContract();

  if (isLoading || customers.isLoading || units.isLoading) return { config: undefined, isLoading: true, error: null };
  if (error || customers.error || units.error) return { config: undefined, isLoading: false, error: error ?? customers.error ?? units.error };

  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const rows = (data ?? []).map((r) => toContractView(r, (id) => units.byId.get(id), (id) => customersById.get(id) ?? id));
  const awaitingCount = rows.filter((r) => r.status === "Awaiting Approval").length;
  const contractedValueEgp = (data ?? []).reduce((s, r) => s + r.valueEgp, 0);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Contracts",
      subtitle: `${rows.length} contracts · ${awaitingCount} awaiting approval`,
      primaryAction: "New Contract",
      columns: contractColumns,
      rows,
      rowKey: (c) => c.id,
      searchText: (c) => `${c.customer} ${c.id} ${c.unit}`,
      searchPlaceholder: "Search contract, customer, unit…",
      kpis: [
        { label: "Contracts", value: String(rows.length) },
        { label: "Awaiting approval", value: String(awaitingCount) },
        { label: "Contracted value", value: `EGP ${(contractedValueEgp / 1e9).toFixed(2)}B` },
      ],
      filters: ["Status: All", "Project: All", "Agent: All"],
      minWidth: 800,
      emptyWhy: "Contracts are drafted for a customer and unit, then move Draft → Signed — clear filters to see contracts at other stages.",
      emptyTitle: "No contracts match this filter",
      createForm: {
        title: "New Contract",
        submitLabel: "Create Contract",
        fields: [
          { name: "customerId", label: "Customer", type: "select", required: true, options: (customers.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
          { name: "unitId", label: "Unit", type: "select", required: true, options: [...units.byId.entries()].map(([id, u]) => ({ value: id, label: `${u.code} · ${u.location}` })) },
          { name: "valueEgp", label: "Value (EGP)", type: "number", required: true, placeholder: "5800000" },
        ],
        onSubmit: async (values) => {
          await createContract.mutateAsync({ customerId: values.customerId, unitId: values.unitId, valueEgp: Number(values.valueEgp) });
        },
      },
    },
  };
}

// ---------- Commissions ----------

const commissionColumns: DataColumn<CommissionView>[] = [
  { key: "agent", label: "Agent", flex: 1.1, render: (c) => TextCell({ value: c.agent }) },
  { key: "period", label: "Period", width: 84, render: (c) => TextCell({ value: c.period, mono: true, weight: "normal" }) },
  { key: "contracts", label: "Contracts", width: 76, align: "end", render: (c) => TextCell({ value: String(c.contracts), mono: true, weight: "normal" }) },
  { key: "salesValue", label: "Sales value", width: 100, align: "end", render: (c) => TextCell({ value: c.salesValue, mono: true, weight: "normal" }) },
  { key: "rate", label: "Rate", width: 64, align: "end", render: (c) => TextCell({ value: c.rate, mono: true, weight: "normal" }) },
  { key: "commission", label: "Commission", width: 108, align: "end", render: (c) => TextCell({ value: c.commission, mono: true }) },
  { key: "status", label: "Status", width: 92, render: (c) => BadgeCell({ status: c.status }) },
];

export function useCommissionsTableConfig(): TableConfigResult<CommissionView> {
  const { data, isLoading, error } = useCommissions();
  const team = useTeamDirectory();
  const updateStatus = useUpdateCommissionStatus();

  if (isLoading || team.isLoading) return { config: undefined, isLoading: true, error: null };
  if (error || team.error) return { config: undefined, isLoading: false, error: error ?? team.error };

  const rows = (data ?? []).map((r) => toCommissionView(r, (id) => team.byId.get(id) ?? id));
  const accruedEgp = (data ?? []).reduce((s, r) => s + r.commissionEgp, 0);
  const approvedEgp = (data ?? []).filter((r) => r.status === "approved").reduce((s, r) => s + r.commissionEgp, 0);
  const paidEgp = (data ?? []).filter((r) => r.status === "paid").reduce((s, r) => s + r.commissionEgp, 0);
  const pendingIds = (data ?? []).filter((r) => r.status === "pending").map((r) => r.id);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Commissions",
      subtitle: "Agent commission accrual, approval, and payout for the selected period",
      primaryAction: pendingIds.length > 0 ? "Approve Pending" : undefined,
      columns: commissionColumns,
      rows,
      rowKey: (c) => c.id,
      searchText: (c) => `${c.agent} ${c.period}`,
      searchPlaceholder: "Search agent…",
      kpis: [
        { label: "Accrued", value: `EGP ${(accruedEgp / 1e6).toFixed(1)}M` },
        { label: "Approved", value: `EGP ${(approvedEgp / 1e6).toFixed(1)}M` },
        { label: "Paid", value: `EGP ${(paidEgp / 1e6).toFixed(1)}M` },
        { label: "Pending", value: String(pendingIds.length) },
      ],
      filters: ["Agent: All", "Period: All", "Status: All"],
      minWidth: 780,
      emptyWhy: "Commission lines are generated per agent for each signed contract in the selected period — switch periods or clear filters to see other payout cycles.",
      emptyTitle: "No commissions match this filter",
      onConfirmAction: async () => {
        await Promise.all(pendingIds.map((id) => updateStatus.mutateAsync({ id, status: "approved" })));
      },
    },
  };
}
