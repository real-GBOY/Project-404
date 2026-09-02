import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/**
 * Permissions the Staff module contributes to RBAC (§3.2). A staff member is a
 * Core user + an org membership + a `staff_profiles` row (bar registration,
 * department, title, rate). RBAC role management stays in Core `/api/rbac`.
 */
export const staffPermissions: PermissionDefinition[] = [
  { action: "read", resource: "staff", description: "View the team and staff profiles" },
  { action: "manage", resource: "staff", description: "Add / edit staff profiles and rates" },
];
