import { createElement, type ReactNode } from "react";
import type { TableConfigRegistry } from "@/features/shared/table-types";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import { RESERVATIONS, type ReservationFixture } from "@/mocks/fixtures/reservations";
import { DEALS, type DealFixture } from "@/mocks/fixtures/deals";
import { CONTRACTS, type ContractFixture } from "@/mocks/fixtures/contracts";
import { COMMISSIONS, type CommissionFixture } from "@/mocks/fixtures/commissions";

/**
 * Table configs for: reservations, deals, contracts, commissions.
 * Plain `.ts` (no JSX) — cell renderers are invoked as functions, not JSX tags.
 */

// ---------- Reservations ----------

/** Countdown sub-line, colored by urgency — the only extra visual weight
 *  "expiring soon" rows get (no separate badge/icon, per the design's own
 *  "don't add visual noise" instruction for this screen). */
function expirySub(r: ReservationFixture): ReactNode {
  if (r.status === "Expired") return createElement("span", { className: "font-mono font-semibold text-danger" }, r.expires);
  if (r.status === "Expiring") return createElement("span", { className: "font-mono font-semibold text-warning" }, r.expires);
  return r.expires;
}

const reservationColumns: DataColumn<ReservationFixture>[] = [
  { key: "unit", label: "Unit", width: 112, render: (r) => TextCell({ value: r.unitId, sub: r.unitLocation, mono: true }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (r) => TextCell({ value: r.customer }) },
  { key: "agent", label: "Agent", flex: 1, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "reserved", label: "Reserved", width: 150, render: (r) => TextCell({ value: r.reservedDate, sub: expirySub(r), mono: true }) },
  { key: "deposit", label: "Deposit", width: 104, align: "end", render: (r) => TextCell({ value: r.deposit, mono: true }) },
  { key: "status", label: "Status", width: 92, render: (r) => BadgeCell({ status: r.status }) },
];

// ---------- Deals ----------

const dealColumns: DataColumn<DealFixture>[] = [
  { key: "id", label: "Deal", width: 76, render: (d) => TextCell({ value: d.id, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (d) => TextCell({ value: d.customer }) },
  { key: "unit", label: "Unit", flex: 1.3, render: (d) => TextCell({ value: d.unit, weight: "normal" }) },
  { key: "value", label: "Value", width: 92, align: "end", render: (d) => TextCell({ value: d.value, mono: true }) },
  { key: "stage", label: "Stage", width: 104, render: (d) => BadgeCell({ status: d.stage }) },
  { key: "probability", label: "Probability", width: 112, render: (d) => BarCell({ pct: d.probabilityPct, label: `${d.probabilityPct}%` }) },
  { key: "close", label: "Expected close", width: 104, render: (d) => TextCell({ value: d.expectedClose, mono: true, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.9, render: (d) => TextCell({ value: d.agent, weight: "normal" }) },
];

// ---------- Contracts ----------

const contractColumns: DataColumn<ContractFixture>[] = [
  { key: "id", label: "Contract", width: 84, render: (c) => TextCell({ value: c.id, mono: true, weight: "normal" }) },
  { key: "customer", label: "Customer", flex: 1.2, render: (c) => TextCell({ value: c.customer }) },
  { key: "unit", label: "Unit", flex: 1.3, render: (c) => TextCell({ value: c.unit, weight: "normal" }) },
  { key: "value", label: "Value", width: 96, align: "end", render: (c) => TextCell({ value: c.value, mono: true }) },
  { key: "signed", label: "Signed", width: 100, render: (c) => TextCell({ value: c.signed, mono: true, weight: "normal" }) },
  { key: "docs", label: "Docs", width: 56, align: "end", render: (c) => TextCell({ value: String(c.docs), mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 132, render: (c) => BadgeCell({ status: c.status }) },
];

// ---------- Commissions ----------

const commissionColumns: DataColumn<CommissionFixture>[] = [
  { key: "agent", label: "Agent", flex: 1.1, render: (c) => TextCell({ value: c.agent }) },
  { key: "period", label: "Period", width: 84, render: (c) => TextCell({ value: c.period, mono: true, weight: "normal" }) },
  { key: "contracts", label: "Contracts", width: 76, align: "end", render: (c) => TextCell({ value: String(c.contracts), mono: true, weight: "normal" }) },
  { key: "salesValue", label: "Sales value", width: 100, align: "end", render: (c) => TextCell({ value: c.salesValue, mono: true, weight: "normal" }) },
  { key: "rate", label: "Rate", width: 64, align: "end", render: (c) => TextCell({ value: c.rate, mono: true, weight: "normal" }) },
  { key: "commission", label: "Commission", width: 108, align: "end", render: (c) => TextCell({ value: c.commission, mono: true }) },
  { key: "status", label: "Status", width: 92, render: (c) => BadgeCell({ status: c.status }) },
];

export const salesTableConfigs: TableConfigRegistry = {
  reservations: {
    title: "Reservations",
    subtitle: "110 active reservations · 4 expiring within 48 hours · EGP 682M reserved value",
    primaryAction: "New Reservation",
    columns: reservationColumns,
    rows: RESERVATIONS,
    rowKey: (r) => r.unitId,
    searchText: (r) => `${r.customer} ${r.unitId} ${r.unitLocation} ${r.agent}`,
    searchPlaceholder: "Search unit, customer, agent…",
    kpis: [
      { label: "Active", value: "110", delta: "+12", deltaSign: "up" },
      { label: "Expiring ≤48h", value: "4" },
      { label: "Reserved value", value: "EGP 682M", delta: "+8.4%", deltaSign: "up" },
      { label: "Conversion to contract", value: "78.2%", delta: "+2.6pp", deltaSign: "up" },
    ],
    filters: ["Status: All", "Project: All", "Agent: All"],
    emptyWhy:
      "Reservations are logged automatically whenever an agent places a temporary hold on an available unit — clear filters or check back once a new hold is created.",
    emptyTitle: "No reservations match this filter",
  },

  deals: {
    title: "Deals",
    subtitle: "84 open deals · EGP 1.12B weighted pipeline · close probability from stage and activity",
    primaryAction: "New Deal",
    columns: dealColumns,
    rows: DEALS,
    rowKey: (d) => d.id,
    searchText: (d) => `${d.customer} ${d.id} ${d.unit} ${d.agent}`,
    searchPlaceholder: "Search deal, customer, unit…",
    kpis: [
      { label: "Open deals", value: "84", delta: "+7", deltaSign: "up" },
      { label: "Pipeline value", value: "EGP 1.86B", delta: "+12.1%", deltaSign: "up" },
      { label: "Weighted pipeline", value: "EGP 1.12B", delta: "+9.6%", deltaSign: "up" },
      { label: "Avg. deal value", value: "EGP 6.2M", delta: "+4.0%", deltaSign: "up" },
      { label: "Win rate", value: "64.8%", delta: "+1.9pp", deltaSign: "up" },
    ],
    filters: ["Stage: All", "Agent: All", "Expected close"],
    minWidth: 800,
    emptyWhy:
      "Deals open the moment a qualified lead shortlists a unit and move through Viewing → Negotiation → Reserved — clear the stage or agent filter to see deals elsewhere in the pipeline.",
    emptyTitle: "No deals match this filter",
  },

  contracts: {
    title: "Contracts",
    subtitle: "312 contracts · 6 awaiting approval · EGP 8.94B contracted value",
    primaryAction: "New Contract",
    columns: contractColumns,
    rows: CONTRACTS,
    rowKey: (c) => c.id,
    searchText: (c) => `${c.customer} ${c.id} ${c.unit}`,
    searchPlaceholder: "Search contract, customer, unit…",
    kpis: [
      { label: "Contracts", value: "312", delta: "+9", deltaSign: "up" },
      { label: "Awaiting approval", value: "6" },
      { label: "Contracted value", value: "EGP 8.94B", delta: "+7.2%", deltaSign: "up" },
      { label: "Avg. time to sign", value: "11 days", delta: "-2", deltaSign: "down" },
    ],
    filters: ["Status: All", "Project: All", "Agent: All"],
    minWidth: 800,
    emptyWhy:
      "Contracts are drafted from a Reserved deal and move Draft → Awaiting Approval → Signed — clear filters to see contracts at other stages.",
    emptyTitle: "No contracts match this filter",
  },

  commissions: {
    title: "Commissions",
    subtitle: "Agent commission accrual, approval, and payout for the selected period",
    primaryAction: "Approve Commissions",
    columns: commissionColumns,
    rows: COMMISSIONS,
    rowKey: (c) => `${c.agent}_${c.period}`,
    searchText: (c) => `${c.agent} ${c.period}`,
    searchPlaceholder: "Search agent…",
    kpis: [
      { label: "Accrued", value: "EGP 42.8M", delta: "+6.1%", deltaSign: "up" },
      { label: "Approved", value: "EGP 31.2M" },
      { label: "Paid this month", value: "EGP 18.6M", delta: "+9.2%", deltaSign: "up" },
      { label: "Held", value: "EGP 4.1M" },
    ],
    filters: ["Agent: All", "Period: All", "Status: All"],
    minWidth: 780,
    emptyWhy:
      "Commission lines are generated per agent for each signed contract in the selected period — switch periods or clear filters to see other payout cycles.",
    emptyTitle: "No commissions match this filter",
  },
};
