import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const dashboardPermissions: PermissionDefinition[] = [
  { action: "read", resource: "dashboard", description: "View the operations dashboard and KPIs." },
];
