import type { PermissionDefinition } from "../shared/rbac.js";

/** Permissions the Clients module contributes to RBAC (§3.2). */
export const clientPermissions: PermissionDefinition[] = [
  { action: "read", resource: "client", description: "View clients, contacts and their profiles" },
  { action: "create", resource: "client", description: "Add a new client" },
  { action: "update", resource: "client", description: "Edit client details and contacts" },
  { action: "archive", resource: "client", description: "Archive or restore a client" },
];
