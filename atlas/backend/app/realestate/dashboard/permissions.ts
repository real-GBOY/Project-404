import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const dashboardPermissions: PermissionDefinition[] = [
  { action: "read", resource: "dashboard", description: "View the executive dashboard and analytics." },
];
