import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const analyticsPermissions: PermissionDefinition[] = [
  {
    action: "read",
    resource: "analytics",
    description: "View performance analytics: occupancy, ADR, RevPAR, revenue and channels.",
  },
];
