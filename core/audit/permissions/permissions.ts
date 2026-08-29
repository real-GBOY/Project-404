import type { PermissionDefinition } from "../../rbac/domain/permission.js";

export const auditPermissions: PermissionDefinition[] = [
  { action: "read", resource: "audit_log", description: "Query the audit trail" },
];
