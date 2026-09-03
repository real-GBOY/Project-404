import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/** Permissions the Hearings module contributes to RBAC (§3.2). */
export const hearingPermissions: PermissionDefinition[] = [
  { action: "read", resource: "hearing", description: "View court hearings" },
  { action: "schedule", resource: "hearing", description: "Schedule or adjourn a hearing" },
  {
    action: "update",
    resource: "hearing",
    description: "Edit hearing details and record outcomes",
  },
];
