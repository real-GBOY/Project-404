import type { PermissionDefinition } from "@core/rbac/domain/permission.js";

/** Permissions governing RBAC administration itself. */
export const rbacPermissions: PermissionDefinition[] = [
  { action: "read", resource: "role", description: "View roles and permissions" },
  { action: "manage", resource: "role", description: "Create roles, grant/revoke permissions" },
  { action: "assign", resource: "role", description: "Assign or remove a user's roles" },
];
