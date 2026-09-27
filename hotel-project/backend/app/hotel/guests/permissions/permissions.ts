import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const guestsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "guest", description: "View guest profiles and history." },
  { action: "create", resource: "guest", description: "Register new guests." },
  { action: "update", resource: "guest", description: "Edit guest details and add notes." },
];
