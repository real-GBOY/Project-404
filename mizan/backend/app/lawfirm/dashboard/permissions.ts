import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/** Permissions the Dashboard module contributes to RBAC (§3.2). Read-only aggregate view. */
export const dashboardPermissions: PermissionDefinition[] = [
  { action: "read", resource: "dashboard", description: "View the firm dashboard" },
];
