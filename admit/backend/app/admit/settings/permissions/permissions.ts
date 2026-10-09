import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const settingsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "admit_settings", description: "View organizer settings." },
  { action: "update", resource: "admit_settings", description: "Edit organizer settings." },
];
