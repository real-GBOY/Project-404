import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/** Permissions the Time module contributes to RBAC (§3.2). */
export const timePermissions: PermissionDefinition[] = [
  { action: "read", resource: "time_entry", description: "View logged time" },
  { action: "create", resource: "time_entry", description: "Log a time entry" },
  { action: "update", resource: "time_entry", description: "Edit a time entry" },
  { action: "delete", resource: "time_entry", description: "Delete a time entry" },
];
