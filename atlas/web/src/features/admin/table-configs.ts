import type { TableConfigRegistry } from "@/features/shared/table-types";
import type { DataColumn } from "@/components/tables/data-table";
import { TextCell, BadgeCell } from "@/components/tables/data-table";
import { TEAM, type TeamMemberFixture } from "@/mocks/fixtures/team";
import { ROLES, type RoleFixture } from "@/mocks/fixtures/roles";

/** Table configs for: team, roles. */

// ---------- Team ----------

const teamColumns: DataColumn<TeamMemberFixture>[] = [
  { key: "name", label: "Name", flex: 1.3, render: (r) => TextCell({ value: r.name, sub: r.email }) },
  { key: "role", label: "Role", flex: 1.1, render: (r) => TextCell({ value: r.role, weight: "normal" }) },
  { key: "team", label: "Team", flex: 0.9, render: (r) => TextCell({ value: r.team, weight: "normal" }) },
  { key: "assignedLeads", label: "Assigned Leads", width: 100, align: "end", render: (r) => TextCell({ value: String(r.assignedLeads), mono: true, weight: "normal" }) },
  { key: "salesMtd", label: "Sales MTD", width: 100, align: "end", render: (r) => TextCell({ value: r.salesMtd, mono: true }) },
  { key: "lastActive", label: "Last Active", width: 88, align: "end", render: (r) => TextCell({ value: r.lastActive, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 80, render: (r) => BadgeCell({ status: r.status }) },
];

// ---------- Roles ----------

const rolesColumns: DataColumn<RoleFixture>[] = [
  { key: "name", label: "Role", flex: 1.2, render: (r) => TextCell({ value: r.name }) },
  { key: "users", label: "Users", width: 70, align: "end", render: (r) => TextCell({ value: String(r.users), mono: true, weight: "normal" }) },
  { key: "dataScope", label: "Data Scope", flex: 1.1, render: (r) => TextCell({ value: r.dataScope, weight: "normal" }) },
  { key: "discountAuthority", label: "Discount Authority", width: 130, align: "end", render: (r) => TextCell({ value: r.discountAuthority, mono: true, weight: "normal" }) },
  { key: "canApprove", label: "Can Approve", flex: 1.3, render: (r) => TextCell({ value: r.canApprove, weight: "normal" }) },
  { key: "status", label: "Status", width: 80, render: (r) => BadgeCell({ status: r.status }) },
];

export const adminTableConfigs: TableConfigRegistry = {
  team: {
    title: "Team",
    subtitle: "38 users · 6 roles · SSO enforced through Microsoft Entra ID",
    primaryAction: "Invite Team Member",
    columns: teamColumns,
    rows: TEAM,
    rowKey: (r) => r.email,
    searchText: (r) => `${r.name} ${r.email} ${r.role} ${r.team}`,
    searchPlaceholder: "Search team by name, email, role…",
    kpis: [
      { label: "Users", value: "38", delta: "+3", deltaSign: "up" },
      { label: "Sales Agents", value: "19" },
      { label: "Pending Invites", value: "2" },
      { label: "MFA Coverage", value: "100%" },
    ],
    filters: ["Role: All", "Team: All", "Status: All"],
    emptyWhy: "Team members are added automatically when they accept an SSO invite through Microsoft Entra ID — invite someone or clear this filter to see the full roster.",
    emptyTitle: "No team members match this filter",
  },

  roles: {
    title: "Roles & Permissions",
    subtitle: "6 roles · granular permissions across 14 modules with approval thresholds",
    primaryAction: "New Role",
    columns: rolesColumns,
    rows: ROLES,
    rowKey: (r) => r.name,
    searchText: (r) => `${r.name} ${r.dataScope} ${r.canApprove}`,
    searchPlaceholder: "Search roles by name, scope…",
    kpis: [
      { label: "Roles", value: "6" },
      { label: "Custom Roles", value: "2" },
      { label: "Users Assigned", value: "38" },
      { label: "Escalation Rules", value: "9" },
    ],
    filters: ["Data Scope: All"],
    emptyWhy: "Roles define the permission, discount authority and approval scope every user inherits — create a role or clear this filter to see the full list.",
    emptyTitle: "No roles match this filter",
  },
};
