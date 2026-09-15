import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import type { TableConfigResult, TableQueryParams } from "@/features/shared/table-types";
import { useTeam } from "@/api/team";
import { useRoles, toRoleView, useAuditLogs, toAuditLogView, type RoleView, type AuditLogView } from "@/api/admin";

/** Table configs for: team, roles, audit. */

/** Distinct values actually present across the full (unfiltered) dataset —
 *  legitimate for a field with no fixed enum, computed from the *unfiltered*
 *  query so it never shrinks as a filter narrows `rows`. */
function distinctOptions<T>(rows: T[], get: (r: T) => string): Array<{ value: string; label: string }> {
  return Array.from(new Set(rows.map(get))).sort().map((v) => ({ value: v, label: v }));
}

// ---------- Team ----------

export interface TeamMemberView {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedLeads: number;
  status: string;
}

const teamColumns: DataColumn<TeamMemberView>[] = [
  { key: "name", label: "Name", flex: 1.3, render: (r) => TextCell({ value: r.name, sub: r.email }) },
  { key: "role", label: "Role", flex: 1.1, render: (r) => TextCell({ value: r.role, weight: "normal" }) },
  { key: "assignedLeads", label: "Assigned Leads", width: 100, align: "end", render: (r) => TextCell({ value: String(r.assignedLeads), mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 80, render: (r) => BadgeCell({ status: r.status }) },
];

export function useTeamTableConfig(params: TableQueryParams): TableConfigResult<TeamMemberView> {
  const filtered = useTeam({ role: params.filters.role, q: params.q });
  const all = useTeam();

  if (filtered.isLoading || all.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error) return { config: undefined, isLoading: false, error: filtered.error ?? all.error };

  const toView = (m: NonNullable<typeof filtered.data>["items"][number]) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    assignedLeads: m.assignedLeads,
    status: "Active",
  });
  const rows = (filtered.data?.items ?? []).map(toView);
  const allRows = (all.data?.items ?? []).map(toView);
  const roleOptions = distinctOptions(allRows, (r) => r.role);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Team",
      subtitle: `${allRows.length} users · ${roleOptions.length} roles`,
      columns: teamColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search team by name, email…",
      kpis: [
        { label: "Users", value: String(allRows.length) },
        { label: "Roles", value: String(roleOptions.length) },
      ],
      filters: [{ label: "Role", param: "role", options: roleOptions }],
      emptyWhy: "Team members are added when they're added to the organization — none match this filter yet.",
      emptyTitle: "No team members match this filter",
    },
  };
}

// ---------- Roles ----------

const rolesColumns: DataColumn<RoleView>[] = [
  { key: "name", label: "Role", flex: 1.2, render: (r) => TextCell({ value: r.name }) },
  { key: "dataScope", label: "Data Scope", flex: 1.1, render: (r) => TextCell({ value: r.dataScope, weight: "normal" }) },
  { key: "discountAuthority", label: "Discount Authority", width: 130, align: "end", render: (r) => TextCell({ value: r.discountAuthority, mono: true, weight: "normal" }) },
  { key: "canApprove", label: "Can Approve", flex: 1.3, render: (r) => TextCell({ value: r.canApprove, weight: "normal" }) },
  { key: "status", label: "Status", width: 80, render: (r) => BadgeCell({ status: r.status }) },
];

export function useRolesTableConfig(params: TableQueryParams): TableConfigResult<RoleView> {
  const { data, isLoading, error } = useRoles();

  if (isLoading) return { config: undefined, isLoading: true, error: null };
  if (error) return { config: undefined, isLoading: false, error };

  // The role catalog is a small, fixed set (a handful of built-in roles), so
  // it's fetched once and filtered client-side rather than round-tripping
  // the backend per keystroke — same justified exception as Availability.
  const allRows = (data?.items ?? []).map(toRoleView);
  const dataScope = params.filters.dataScope;
  const q = params.q?.trim().toLowerCase();
  const rows = allRows.filter(
    (r) => (!dataScope || r.dataScope === dataScope) && (!q || `${r.name} ${r.dataScope} ${r.canApprove}`.toLowerCase().includes(q)),
  );
  const dataScopeOptions = distinctOptions(allRows, (r) => r.dataScope);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Roles & Permissions",
      subtitle: `${allRows.length} roles · fixed permission matrix per role`,
      columns: rolesColumns,
      rows,
      rowKey: (r) => r.key,
      searchPlaceholder: "Search roles by name, scope…",
      kpis: [{ label: "Roles", value: String(allRows.length) }],
      filters: [{ label: "Data Scope", param: "dataScope", options: dataScopeOptions }],
      emptyWhy: "Roles define the permission, discount authority and approval scope every user inherits — clear this filter to see the full list.",
      emptyTitle: "No roles match this filter",
    },
  };
}

// ---------- Audit ----------

const auditColumns: DataColumn<AuditLogView>[] = [
  { key: "timestamp", label: "Timestamp", width: 138, render: (r) => TextCell({ value: r.timestamp, mono: true, weight: "normal" }) },
  { key: "user", label: "User", flex: 1, render: (r) => TextCell({ value: r.user }) },
  { key: "action", label: "Action", width: 120, render: (r) => BadgeCell({ status: r.action }) },
  { key: "entity", label: "Entity", flex: 1.4, render: (r) => TextCell({ value: r.entity, weight: "normal" }) },
];

export function useAuditTableConfig(params: TableQueryParams): TableConfigResult<AuditLogView> {
  const filtered = useAuditLogs({ action: params.filters.action, actor: params.filters.user, q: params.q });
  const all = useAuditLogs();

  if (filtered.isLoading || all.isLoading) return { config: undefined, isLoading: true, error: null };
  if (filtered.error || all.error) return { config: undefined, isLoading: false, error: filtered.error ?? all.error };

  const rows = (filtered.data?.items ?? []).map(toAuditLogView);
  const allRows = (all.data?.items ?? []).map(toAuditLogView);
  const userOptions = distinctOptions(allRows, (r) => r.user);
  const actionOptions = distinctOptions(allRows, (r) => r.action);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Audit Logs",
      subtitle: `Immutable record of every state change · ${all.data?.total ?? allRows.length} entries`,
      columns: auditColumns,
      rows,
      rowKey: (r) => r.id,
      searchPlaceholder: "Search audit log…",
      filters: [
        { label: "User", param: "user", options: userOptions },
        { label: "Action", param: "action", options: actionOptions },
      ],
      minWidth: 700,
      kpis: [{ label: "Entries shown", value: String(rows.length) }],
      emptyWhy: "Every reservation, approval, price change and payment writes an entry here the moment it happens — none currently match this filter.",
      emptyTitle: "No audit entries match this filter",
    },
  };
}
