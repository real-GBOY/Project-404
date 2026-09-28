import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const maintenancePermissions: PermissionDefinition[] = [
  { action: "read", resource: "maintenance", description: "View maintenance tickets." },
  { action: "create", resource: "maintenance", description: "Report a maintenance issue." },
  {
    action: "update",
    resource: "maintenance",
    description: "Work own tickets: start, add notes and cost, resolve.",
  },
  {
    action: "manage",
    resource: "maintenance",
    description: "Assign, verify and reopen tickets; take rooms out of sale.",
  },
];
