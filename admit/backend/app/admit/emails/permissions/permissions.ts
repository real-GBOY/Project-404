import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const emailsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "email", description: "See email delivery status." },
  { action: "retry", resource: "email", description: "Retry a failed email." },
];
