import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const reportsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "report", description: "Sales, payment and attendance reports." },
];
