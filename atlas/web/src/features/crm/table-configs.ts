import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell, BarCell } from "@/components/tables/data-table";
import type { TableConfigResult, TableQueryParams } from "@/features/shared/table-types";
import { titleCase } from "@/lib/text";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import {
  useLeads,
  useCreateLead,
  toLeadView,
  useCustomers,
  useCreateCustomer,
  toCustomerView,
  useActivities,
  useCreateActivity,
  toActivityView,
  useFollowups,
  useCreateFollowup,
  toFollowupView,
  type LeadView,
  type LeadSource,
  type LeadStatus,
  type CustomerRow,
  type CustomerStatus,
  type CustomerView,
  type ActivityView,
  type ActivityType,
  type FollowupView,
  type FollowupPriority,
  type FollowupStatus,
} from "@/api/crm";
import { useProjectDirectory } from "@/api/properties";

const LEAD_STATUSES: LeadStatus[] = ["new", "qualified", "contacted", "viewing", "negotiation", "lost"];
const LEAD_SOURCES: LeadSource[] = ["referral", "website", "facebook", "broker", "exhibition", "instagram"];
const ACTIVITY_TYPES: ActivityType[] = ["call", "meeting", "viewing", "email", "note", "whatsapp"];
const FOLLOWUP_PRIORITIES: FollowupPriority[] = ["high", "medium", "low"];
const FOLLOWUP_STATUSES: FollowupStatus[] = ["open", "in-progress", "overdue", "done"];

/**
 * Table configs for: leads, customers, activities, followups — each exported
 * as a `use<Entity>TableConfig()` hook (not a static object) since rows now
 * come from the real backend. Plain `.ts` (no JSX) — cell renderers are
 * invoked as functions, not JSX tags.
 */

// ---------- Leads ----------

const leadsColumns: DataColumn<LeadView>[] = [
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

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function useLeadsTableConfig(params: TableQueryParams): TableConfigResult<LeadView> {
  const filtered = useLeads({
    status: params.filters.status as LeadStatus | undefined,
    source: params.filters.source as LeadSource | undefined,
    agentId: params.filters.agentId,
    q: params.q,
  });
  // Unfiltered, for KPIs — a search or filter shouldn't make "Qualified" read 0.
  const all = useLeads();
  const team = useTeamDirectory();
  const createLead = useCreateLead();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error || team.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error };
  }

  const rows = filtered.data!.map((r) => toLeadView(r, (id) => team.byId.get(id) ?? id));
  const allRows = all.data!.map((r) => toLeadView(r, (id) => team.byId.get(id) ?? id));
  const statusCounts = countBy(allRows, (r) => r.status);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Leads",
      subtitle: `${allRows.length} leads`,
      primaryAction: "New Lead",
      columns: leadsColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search leads by name, phone, ID…",
      kpis: [
        { label: "Total Leads", value: String(allRows.length) },
        { label: "Qualified", value: String(statusCounts["Qualified"] ?? 0) },
        { label: "In Negotiation", value: String(statusCounts["Negotiation"] ?? 0) },
        { label: "Lost", value: String(statusCounts["Lost"] ?? 0) },
      ],
      filters: [
        { label: "Status", param: "status", options: LEAD_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
        { label: "Source", param: "source", options: LEAD_SOURCES.map((s) => ({ value: s, label: titleCase(s) })) },
        { label: "Agent", param: "agentId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
      ],
      emptyWhy: "Leads arrive automatically from the website, referrals, brokers, exhibitions and social campaigns — once new leads come in, or you clear this filter, they'll show up here.",
      emptyTitle: "No leads match this filter",
      createForm: {
        title: "New Lead",
        submitLabel: "Create Lead",
        fields: [
          { name: "name", label: "Name", required: true, placeholder: "Full name" },
          { name: "phone", label: "Phone", required: true, placeholder: "+20 1xx xxx xxxx" },
          { name: "email", label: "Email", type: "email", placeholder: "optional@email.com" },
          {
            name: "source",
            label: "Source",
            type: "select",
            required: true,
            defaultValue: "website",
            options: ["referral", "website", "facebook", "broker", "exhibition", "instagram"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
          },
          {
            name: "agentId",
            label: "Agent",
            type: "select",
            required: true,
            defaultValue: auth.user?.id,
            options: team.members.map((m) => ({ value: m.id, label: m.name })),
          },
          { name: "interestText", label: "Interest", placeholder: "e.g. North Hills · A-0904" },
          { name: "valueEgp", label: "Deal Value (EGP)", type: "number", placeholder: "5400000" },
        ],
        onSubmit: async (values) => {
          await createLead.mutateAsync({
            name: values.name,
            phone: values.phone,
            email: values.email || null,
            source: values.source as LeadSource,
            agentId: values.agentId,
            interestText: values.interestText || null,
            valueEgp: values.valueEgp ? Number(values.valueEgp) : undefined,
          });
        },
      },
    },
  };
}

// ---------- Customers ----------

const customersColumns: DataColumn<CustomerView>[] = [
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

export function useCustomersTableConfig(params: TableQueryParams): TableConfigResult<CustomerView> {
  const filtered = useCustomers({
    status: params.filters.status as CustomerStatus | undefined,
    primaryProjectId: params.filters.primaryProjectId,
    agentId: params.filters.agentId,
    q: params.q,
  });
  const all = useCustomers();
  const team = useTeamDirectory();
  const projects = useProjectDirectory();
  const createCustomer = useCreateCustomer();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading || projects.isLoading) {
    return { config: undefined, isLoading: true, error: null };
  }
  if (filtered.error || all.error || team.error || projects.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error ?? projects.error };
  }

  const toView = (r: CustomerRow) =>
    toCustomerView(
      r,
      (id) => team.byId.get(id) ?? id,
      (id) => (id ? projects.byId.get(id) ?? id : "—"),
    );
  const rows = filtered.data!.map(toView);
  const allRows = all.data!.map(toView);
  const activeCount = allRows.filter((r) => r.status === "Active").length;
  const totalPortfolioEgp = all.data!.reduce((sum, r) => sum + r.portfolioEgp, 0);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Customers",
      subtitle: `${allRows.length} customers · ${activeCount} active`,
      primaryAction: "New Customer",
      columns: customersColumns,
      rows,
      rowKey: (r) => r.id,
      onRowClick: (row) => `/customers/${row.id}`,
      searchPlaceholder: "Search customers by name, email, phone…",
      kpis: [
        { label: "Customers", value: String(allRows.length) },
        { label: "Active", value: String(activeCount) },
        { label: "Lifetime Value", value: totalPortfolioEgp > 0 ? `EGP ${(totalPortfolioEgp / 1e6).toFixed(1)}M` : "EGP 0" },
        { label: "Avg. Units / Customer", value: allRows.length ? (allRows.reduce((s, r) => s + r.unitsOwned, 0) / allRows.length).toFixed(1) : "0" },
      ],
      filters: [
        { label: "Status", param: "status", options: [{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }] },
        { label: "Project", param: "primaryProjectId", options: projects.projects.map((p) => ({ value: p.id, label: p.name })) },
        { label: "Agent", param: "agentId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
      ],
      emptyWhy: "Customers are created automatically once a lead's reservation converts to a signed contract — clear this filter or check back once a deal closes.",
      emptyTitle: "No customers match this filter",
      createForm: {
        title: "New Customer",
        submitLabel: "Create Customer",
        fields: [
          { name: "name", label: "Name", required: true, placeholder: "Full name" },
          { name: "email", label: "Email", type: "email", placeholder: "optional@email.com" },
          { name: "phone", label: "Phone", placeholder: "+20 1xx xxx xxxx" },
          {
            name: "primaryProjectId",
            label: "Primary Project",
            type: "select",
            options: projects.projects.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            name: "agentId",
            label: "Agent",
            type: "select",
            required: true,
            defaultValue: auth.user?.id,
            options: team.members.map((m) => ({ value: m.id, label: m.name })),
          },
        ],
        onSubmit: async (values) => {
          await createCustomer.mutateAsync({
            name: values.name,
            email: values.email || null,
            phone: values.phone || null,
            primaryProjectId: values.primaryProjectId || null,
            agentId: values.agentId,
          });
        },
      },
    },
  };
}

// ---------- Activities ----------

const activitiesColumns: DataColumn<ActivityView>[] = [
  { key: "type", label: "Type", width: 100, render: (r) => BadgeCell({ status: r.type }) },
  { key: "subject", label: "Subject", flex: 1.5, render: (r) => TextCell({ value: r.subject }) },
  { key: "relatedTo", label: "Related To", flex: 1.2, render: (r) => TextCell({ value: r.relatedTo, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.8, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "outcome", label: "Outcome", flex: 1, render: (r) => TextCell({ value: r.outcome, weight: "normal" }) },
  { key: "when", label: "When", width: 84, align: "end", render: (r) => TextCell({ value: r.when, mono: true, weight: "normal" }) },
];

export function useActivitiesTableConfig(params: TableQueryParams): TableConfigResult<ActivityView> {
  const filtered = useActivities({
    type: params.filters.type as ActivityType | undefined,
    agentId: params.filters.agentId,
    q: params.q,
  });
  const all = useActivities();
  const team = useTeamDirectory();
  const leads = useLeads();
  const customers = useCustomers();
  const createActivity = useCreateActivity();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading || leads.isLoading || customers.isLoading) {
    return { config: undefined, isLoading: true, error: null };
  }
  if (filtered.error || all.error || team.error || leads.error || customers.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error ?? leads.error ?? customers.error };
  }

  const leadsById = new Map((leads.data ?? []).map((l) => [l.id, l.name]));
  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const relatedName = (type: "lead" | "customer" | null, id: string | null) => {
    if (!type || !id) return "—";
    const name = type === "lead" ? leadsById.get(id) : customersById.get(id);
    return `${type === "lead" ? "Lead" : "Customer"} ${id}${name ? ` · ${name}` : ""}`;
  };

  const rows = filtered.data!.map((r) => toActivityView(r, (id) => team.byId.get(id) ?? id, relatedName));
  const allRows = all.data!.map((r) => toActivityView(r, (id) => team.byId.get(id) ?? id, relatedName));
  const typeCounts = countBy(allRows, (r) => r.type);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Activities",
      subtitle: "All logged calls, meetings, viewings and notes across the organisation",
      primaryAction: "Log Activity",
      columns: activitiesColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search activities by subject, lead, agent…",
      kpis: [
        { label: "Total Activities", value: String(allRows.length) },
        { label: "Calls", value: String(typeCounts["Call"] ?? 0) },
        { label: "Viewings", value: String(typeCounts["Viewing"] ?? 0) },
        { label: "Meetings", value: String(typeCounts["Meeting"] ?? 0) },
      ],
      filters: [
        { label: "Type", param: "type", options: ACTIVITY_TYPES.map((t) => ({ value: t, label: titleCase(t) })) },
        { label: "Agent", param: "agentId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
      ],
      emptyWhy: "Activities are logged automatically whenever an agent records a call, viewing, negotiation note or payment update — nothing has matched this filter yet.",
      emptyTitle: "No activities match this filter",
      createForm: {
        title: "Log Activity",
        submitLabel: "Log Activity",
        fields: [
          {
            name: "type",
            label: "Type",
            type: "select",
            required: true,
            defaultValue: "call",
            options: ["call", "meeting", "viewing", "email", "note", "whatsapp"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
          },
          { name: "subject", label: "Subject", required: true, placeholder: "What happened?" },
          { name: "outcome", label: "Outcome", placeholder: "e.g. Qualified, escalated, retry scheduled…" },
          {
            name: "relatedId",
            label: "Related Lead",
            type: "select",
            options: (leads.data ?? []).map((l) => ({ value: l.id, label: l.name })),
          },
          {
            name: "agentId",
            label: "Agent",
            type: "select",
            required: true,
            defaultValue: auth.user?.id,
            options: team.members.map((m) => ({ value: m.id, label: m.name })),
          },
        ],
        onSubmit: async (values) => {
          await createActivity.mutateAsync({
            type: values.type as ActivityType,
            subject: values.subject,
            relatedType: values.relatedId ? "lead" : null,
            relatedId: values.relatedId || null,
            agentId: values.agentId,
            outcome: values.outcome || null,
          });
        },
      },
    },
  };
}

// ---------- Follow-ups ----------

const followupsColumns: DataColumn<FollowupView>[] = [
  { key: "priority", label: "Priority", width: 84, render: (r) => BadgeCell({ status: r.priority }) },
  { key: "leadOrCustomer", label: "Lead / Customer", flex: 1.1, render: (r) => TextCell({ value: r.leadOrCustomer }) },
  { key: "reason", label: "Reason", flex: 1.6, render: (r) => TextCell({ value: r.reason, weight: "normal" }) },
  { key: "agent", label: "Agent", flex: 0.8, render: (r) => TextCell({ value: r.agent, weight: "normal" }) },
  { key: "due", label: "Due", width: 100, render: (r) => TextCell({ value: r.due, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 96, render: (r) => BadgeCell({ status: r.status }) },
];

export function useFollowupsTableConfig(params: TableQueryParams): TableConfigResult<FollowupView> {
  const filtered = useFollowups({
    agentId: params.filters.agentId,
    status: params.filters.status as FollowupStatus | undefined,
    priority: params.filters.priority as FollowupPriority | undefined,
    q: params.q,
  });
  const all = useFollowups();
  const team = useTeamDirectory();
  const leads = useLeads();
  const customers = useCustomers();
  const createFollowup = useCreateFollowup();
  const auth = useAuth();

  if (filtered.isLoading || all.isLoading || team.isLoading || leads.isLoading || customers.isLoading) {
    return { config: undefined, isLoading: true, error: null };
  }
  if (filtered.error || all.error || team.error || leads.error || customers.error) {
    return { config: undefined, isLoading: false, error: filtered.error ?? all.error ?? team.error ?? leads.error ?? customers.error };
  }

  const leadsById = new Map((leads.data ?? []).map((l) => [l.id, l.name]));
  const customersById = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
  const relatedName = (leadId: string | null, customerId: string | null) =>
    (leadId && leadsById.get(leadId)) || (customerId && customersById.get(customerId)) || "—";

  const rows = filtered.data!.map((r) => toFollowupView(r, (id) => team.byId.get(id) ?? id, relatedName));
  const allRows = all.data!.map((r) => toFollowupView(r, (id) => team.byId.get(id) ?? id, relatedName));
  const statusCounts = countBy(allRows, (r) => r.status);
  const priorityCounts = countBy(allRows, (r) => r.priority);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Follow-ups",
      subtitle: `${statusCounts["Overdue"] ?? 0} overdue · SLA target 24h after last contact`,
      primaryAction: "Schedule Follow-up",
      columns: followupsColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search follow-ups by lead, customer, agent…",
      kpis: [
        { label: "Overdue", value: String(statusCounts["Overdue"] ?? 0) },
        { label: "Open", value: String(statusCounts["Open"] ?? 0) },
        { label: "Done", value: String(statusCounts["Done"] ?? 0) },
        { label: "High Priority", value: String(priorityCounts["High"] ?? 0) },
      ],
      filters: [
        { label: "Priority", param: "priority", options: FOLLOWUP_PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
        { label: "Status", param: "status", options: FOLLOWUP_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
        { label: "Agent", param: "agentId", options: team.members.map((m) => ({ value: m.id, label: m.name })) },
      ],
      emptyWhy: "Follow-ups are generated automatically from the SLA clock on each lead's last activity — once one falls due, or you clear this filter, it will appear here.",
      emptyTitle: "No follow-ups match this filter",
      createForm: {
        title: "Schedule Follow-up",
        submitLabel: "Schedule",
        fields: [
          { name: "reason", label: "Reason", required: true, placeholder: "What needs following up?" },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            required: true,
            defaultValue: "medium",
            options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
          {
            name: "leadId",
            label: "Lead",
            type: "select",
            options: (leads.data ?? []).map((l) => ({ value: l.id, label: l.name })),
          },
          { name: "dueAt", label: "Due", type: "date", required: true },
          {
            name: "agentId",
            label: "Agent",
            type: "select",
            required: true,
            defaultValue: auth.user?.id,
            options: team.members.map((m) => ({ value: m.id, label: m.name })),
          },
        ],
        onSubmit: async (values) => {
          await createFollowup.mutateAsync({
            reason: values.reason,
            priority: values.priority as FollowupPriority,
            leadId: values.leadId || null,
            dueAt: new Date(values.dueAt).toISOString(),
            agentId: values.agentId,
          });
        },
      },
    },
  };
}
