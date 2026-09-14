import type { TableConfigRegistry } from "@/features/shared/table-types";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import { LEADS, type LeadFixture } from "@/mocks/fixtures/leads";
import { CUSTOMERS, type CustomerFixture } from "@/mocks/fixtures/customers";
import { ACTIVITIES, type ActivityFixture } from "@/mocks/fixtures/activities";
import { FOLLOWUPS, type FollowupFixture } from "@/mocks/fixtures/followups";

/**
 * Table configs for: leads, customers, activities, followups.
 * Plain `.ts` (no JSX) — cell renderers are invoked as functions, not JSX tags.
 */

// ---------- Leads ----------

const leadsColumns: DataColumn<LeadFixture>[] = [
  { key: "id", label: "ID", width: 78, render: (r) => TextCell({ value: r.id, mono: true, weight: "normal" }) },
  { key: "name", label: "Name", flex: 1.4, render: (r) => TextCell({ value: r.name, sub: r.phone }) },
  { key: "source", label: "Source", width: 90, render: (r) => TextCell({ value: r.source, weight: "normal" }) },
  { key: "status", label: "Status", width: 100, render: (r) => BadgeCell({ status: r.status }) },
  { key: "score", label: "Score", width: 90, render: (r) => BarCell({ pct: r.score, label: String(r.score) }) },
  { key: "interest", label: "Interest", flex: 1.3, render: (r) => TextCell({ value: r.interest, weight: "normal" }) },
  { key: "value", label: "Value", width: 90, align: "end", render: (r) => TextCell({ value: r.value, mono: true }) },
  { key: "agent", label: "Agent", flex: 1, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "lastActivity", label: "Last Activity", width: 96, align: "end", render: (r) => TextCell({ value: r.lastActivity, mono: true, weight: "normal" }) },
];

// ---------- Customers ----------

const customersColumns: DataColumn<CustomerFixture>[] = [
  { key: "id", label: "ID", width: 60, render: (r) => TextCell({ value: r.id, mono: true, weight: "normal" }) },
  { key: "name", label: "Name", flex: 1.3, render: (r) => TextCell({ value: r.name, sub: r.email }) },
  { key: "phone", label: "Phone", width: 128, render: (r) => TextCell({ value: r.phone, mono: true, weight: "normal" }) },
  { key: "primaryProject", label: "Primary Project", flex: 1, render: (r) => TextCell({ value: r.primaryProject, weight: "normal" }) },
  { key: "unitsOwned", label: "Units", width: 60, align: "end", render: (r) => TextCell({ value: String(r.unitsOwned), mono: true, weight: "normal" }) },
  { key: "portfolioValue", label: "Portfolio", width: 96, align: "end", render: (r) => TextCell({ value: r.portfolioValue, mono: true }) },
  { key: "collected", label: "Collected", width: 96, align: "end", render: (r) => TextCell({ value: r.collected, mono: true, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.9, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "status", label: "Status", width: 84, render: (r) => BadgeCell({ status: r.status }) },
];

// ---------- Activities ----------

const activitiesColumns: DataColumn<ActivityFixture>[] = [
  { key: "type", label: "Type", width: 100, render: (r) => BadgeCell({ status: r.type }) },
  { key: "subject", label: "Subject", flex: 1.5, render: (r) => TextCell({ value: r.subject }) },
  { key: "relatedTo", label: "Related To", flex: 1.2, render: (r) => TextCell({ value: r.relatedTo, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.8, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "outcome", label: "Outcome", flex: 1, render: (r) => TextCell({ value: r.outcome, weight: "normal" }) },
  { key: "when", label: "When", width: 84, align: "end", render: (r) => TextCell({ value: r.when, mono: true, weight: "normal" }) },
];

// ---------- Follow-ups ----------

const followupsColumns: DataColumn<FollowupFixture>[] = [
  { key: "priority", label: "Priority", width: 84, render: (r) => BadgeCell({ status: r.priority }) },
  { key: "leadOrCustomer", label: "Lead / Customer", flex: 1.1, render: (r) => TextCell({ value: r.leadOrCustomer }) },
  { key: "reason", label: "Reason", flex: 1.6, render: (r) => TextCell({ value: r.reason, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.8, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "due", label: "Due", width: 100, render: (r) => TextCell({ value: r.due, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 96, render: (r) => BadgeCell({ status: r.status }) },
];

// ---------- Aggregate helpers (honest counts from the row data itself) ----------

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

const activityTypeCounts = countBy(ACTIVITIES, (a) => a.type);
const followupStatusCounts = countBy(FOLLOWUPS, (f) => f.status);
const followupPriorityCounts = countBy(FOLLOWUPS, (f) => f.priority);

export const crmTableConfigs: TableConfigRegistry = {
  leads: {
    title: "Leads",
    subtitle: "1,842 leads · 312 active this month · 23 with no activity for 5+ days",
    primaryAction: "New Lead",
    columns: leadsColumns,
    rows: LEADS,
    rowKey: (r) => r.id,
    searchText: (r) => `${r.id} ${r.name} ${r.phone} ${r.source} ${r.agent} ${r.interest}`,
    searchPlaceholder: "Search leads by name, phone, ID…",
    kpis: [
      { label: "Active Leads", value: "312", delta: "+8.2%", deltaSign: "up" },
      { label: "Qualified", value: "148", delta: "+11.4%", deltaSign: "up" },
      { label: "Avg. Lead Score", value: "74", delta: "+3", deltaSign: "up" },
      { label: "Untouched 5d+", value: "23", delta: "+6", deltaSign: "down" },
      { label: "Conversion Rate", value: "11.8%", delta: "+1.4pp", deltaSign: "up" },
    ],
    filters: ["Status: All", "Source: All", "Agent: All"],
    emptyWhy: "Leads arrive automatically from the website, referrals, brokers, exhibitions and social campaigns — once new leads come in, or you clear this filter, they'll show up here.",
    emptyTitle: "No leads match this filter",
  },

  customers: {
    title: "Customers",
    subtitle: "486 customers · 312 with active contracts · EGP 2.84B lifetime value",
    primaryAction: "New Customer",
    columns: customersColumns,
    rows: CUSTOMERS,
    rowKey: (r) => r.id,
    onRowClick: (row) => `/customers/${row.id}`,
    searchText: (r) => `${r.id} ${r.name} ${r.email} ${r.phone} ${r.primaryProject} ${r.agent}`,
    searchPlaceholder: "Search customers by name, email, phone…",
    kpis: [
      { label: "Customers", value: "486", delta: "+14", deltaSign: "up" },
      { label: "Active Contracts", value: "312", delta: "+9", deltaSign: "up" },
      { label: "Lifetime Value", value: "EGP 2.84B", delta: "+4.1%", deltaSign: "up" },
      { label: "Avg. Units / Customer", value: "1.4" },
    ],
    filters: ["Status: All", "Project: All", "Agent: All"],
    emptyWhy: "Customers are created automatically once a lead's reservation converts to a signed contract — clear this filter or check back once a deal closes.",
    emptyTitle: "No customers match this filter",
  },

  activities: {
    title: "Activities",
    subtitle: "All logged calls, meetings, viewings and notes across the organisation",
    primaryAction: "Log Activity",
    columns: activitiesColumns,
    rows: ACTIVITIES,
    rowKey: (r) => `${r.subject}|${r.relatedTo}|${r.when}`,
    searchText: (r) => `${r.type} ${r.subject} ${r.relatedTo} ${r.agent} ${r.outcome}`,
    searchPlaceholder: "Search activities by subject, lead, agent…",
    kpis: [
      { label: "Activities Today", value: "148", delta: "+22", deltaSign: "up" },
      { label: "Calls", value: String(activityTypeCounts["Contacted"] ?? 0) },
      { label: "Viewings", value: String(activityTypeCounts["Viewing"] ?? 0), delta: "+4", deltaSign: "up" },
      { label: "Avg. Response Time", value: "2h 14m", delta: "-18m", deltaSign: "up" },
    ],
    filters: ["Type: All", "Agent: All"],
    emptyWhy: "Activities are logged automatically whenever an agent records a call, viewing, negotiation note or payment update — nothing has matched this filter yet.",
    emptyTitle: "No activities match this filter",
  },

  followups: {
    title: "Follow-ups",
    subtitle: "23 follow-ups overdue · 41 due today · SLA target 24h after last contact",
    primaryAction: "Schedule Follow-up",
    columns: followupsColumns,
    rows: FOLLOWUPS,
    rowKey: (r) => `${r.leadOrCustomer}|${r.reason}|${r.due}`,
    searchText: (r) => `${r.leadOrCustomer} ${r.reason} ${r.agent} ${r.priority} ${r.status}`,
    searchPlaceholder: "Search follow-ups by lead, customer, agent…",
    kpis: [
      { label: "Overdue", value: String(followupStatusCounts["Overdue"] ?? 0), delta: "+6", deltaSign: "down" },
      { label: "Due Today", value: "41" },
      { label: "Completed (7d)", value: "186", delta: "+12%", deltaSign: "up" },
      { label: "On-time Rate", value: "82.4%", delta: "-3.1pp", deltaSign: "down" },
      { label: "High Priority", value: String(followupPriorityCounts["High"] ?? 0) },
    ],
    filters: ["Priority: All", "Status: All", "Agent: All"],
    emptyWhy: "Follow-ups are generated automatically from the SLA clock on each lead's last activity — once one falls due, or you clear this filter, it will appear here.",
    emptyTitle: "No follow-ups match this filter",
  },
};
