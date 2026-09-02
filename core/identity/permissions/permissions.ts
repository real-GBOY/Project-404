import type { PermissionDefinition } from "@core/rbac/domain/permission.js";

/**
 * Permissions this module contributes to the RBAC registry (§3.2). Seeded on
 * migrate so `can(user, "user:read", "user")` resolves.
 */
export const identityPermissions: PermissionDefinition[] = [
  { action: "read", resource: "user", description: "View user accounts" },
  { action: "list", resource: "user", description: "List user accounts" },
  { action: "disable", resource: "user", description: "Disable a user account" },
];
