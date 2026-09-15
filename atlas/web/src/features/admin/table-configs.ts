import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import type { TableConfigResult } from "@/features/shared/table-types";
import { useTeam } from "@/api/team";
import { useRoles, toRoleView, useAuditLogs, toAuditLogView, type RoleView, type AuditLogView } from "@/api/admin";

/** Table configs for: team, roles, audit. */

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

export function useTeamTableConfig(): TableConfigResult<TeamMemberView> {
  const { data, isLoading, error } = useTeam();

  if (isLoading) return { config: undefined, isLoading: true, error: null };
  if (error) return { config: undefined, isLoading: false, error };

  const rows = (data?.items ?? []).map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, assignedLeads: m.assignedLeads, status: "Active" }));
  const roleCounts = new Set(rows.map((r) => r.role)).size;

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Team",
      subtitle: `${rows.length} users · ${roleCounts} roles`,
      columns: teamColumns,
      rows,
      rowKey: (r) => r.id,
      searchText: (r) => `${r.name} ${r.email} ${r.role}`,
      searchPlaceholder: "Search team by name, email, role…",
      kpis: [
        { label: "Users", value: String(rows.length) },
        { label: "Roles", value: String(roleCounts) },
      ],
      filters: ["Role: All", "Status: All"],
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

export function useRolesTableConfig(): TableConfigResult<RoleView> {
  const { data, isLoading, error } = useRoles();

  if (isLoading) return { config: undefined, isLoading: true, error: null };
  if (error) return { config: undefined, isLoading: false, error };

  const rows = (data?.items ?? []).map(toRoleView);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Roles & Permissions",
      subtitle: `${rows.length} roles · fixed permission matrix per role`,
      columns: rolesColumns,
      rows,
      rowKey: (r) => r.key,
      searchText: (r) => `${r.name} ${r.dataScope} ${r.canApprove}`,
      searchPlaceholder: "Search roles by name, scope…",
      kpis: [{ label: "Roles", value: String(rows.length) }],
      filters: ["Data Scope: All"],
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

export function useAuditTableConfig(): TableConfigResult<AuditLogView> {
  const { data, isLoading, error } = useAuditLogs();

  if (isLoading) return { config: undefined, isLoading: true, error: null };
  if (error) return { config: undefined, isLoading: false, error };

  const rows = (data?.items ?? []).map(toAuditLogView);

  return {
    isLoading: false,
    error: null,
    config: {
      title: "Audit Logs",
      subtitle: `Immutable record of every state change · ${data?.total ?? rows.length} entries`,
      columns: auditColumns,
      rows,
      rowKey: (r) => r.id,
      searchText: (r) => `${r.user} ${r.action} ${r.entity}`,
      searchPlaceholder: "Filter audit log…",
      filters: ["User", "Action"],
      minWidth: 700,
      kpis: [{ label: "Entries shown", value: String(rows.length) }],
      emptyWhy: "Every reservation, approval, price change and payment writes an entry here the moment it happens — none currently match this filter.",
      emptyTitle: "No audit entries match this filter",
    },
  };
}
