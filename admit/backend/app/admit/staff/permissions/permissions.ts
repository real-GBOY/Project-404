import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const staffPermissions: PermissionDefinition[] = [
  { action: "manage", resource: "event_staff", description: "Assign people to events and gates." },
];
