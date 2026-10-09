import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const ticketsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "ticket", description: "Look up issued tickets (never their QR tokens)." },
  { action: "revoke", resource: "ticket", description: "Revoke a ticket (refund, holder change, fraud)." },
];
