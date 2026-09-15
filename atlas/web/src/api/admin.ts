import { useQuery } from "@tanstack/react-query";
import { get, ENDPOINTS } from "@/config";

// ---------- Roles ----------

export interface RoleRow {
  key: string;
  name: string;
  permissions: number;
  editable: boolean;
  dataScope?: string;
  discountAuthority?: string;
  canApprove?: string;
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => get<{ items: RoleRow[] }>(ENDPOINTS.rbac.roles) });
}

export interface RoleView {
  key: string;
  name: string;
  dataScope: string;
  discountAuthority: string;
  canApprove: string;
  status: string;
}

export function toRoleView(row: RoleRow): RoleView {
  return {
    key: row.key,
    name: row.name,
    dataScope: row.dataScope ?? "—",
    discountAuthority: row.discountAuthority ?? "—",
    canApprove: row.canApprove ?? "—",
    status: row.editable ? "Custom" : "System",
  };
}

// ---------- Audit logs ----------

export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  resource: string;
  at: string;
}

export interface AuditLogListParams {
  q?: string;
  action?: string;
  actor?: string;
}

export function useAuditLogs(params?: AuditLogListParams) {
  return useQuery({
    queryKey: ["audit-logs", params ?? {}],
    queryFn: () => get<{ items: AuditLogRow[]; total: number }>(ENDPOINTS.auditLogs, params),
  });
}

export interface AuditLogView {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
}

export function toAuditLogView(row: AuditLogRow): AuditLogView {
  return {
    id: row.id,
    timestamp: new Date(row.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    user: row.actor,
    action: row.action,
    entity: row.resource,
  };
}
