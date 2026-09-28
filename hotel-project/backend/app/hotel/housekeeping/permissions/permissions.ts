import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const housekeepingPermissions: PermissionDefinition[] = [
  {
    action: "read",
    resource: "housekeeping",
    description: "View housekeeping tasks and room readiness.",
  },
  {
    action: "update",
    resource: "housekeeping",
    description: "Start and complete own cleaning tasks.",
  },
  {
    action: "manage",
    resource: "housekeeping",
    description: "Create, assign and inspect housekeeping tasks.",
  },
];
