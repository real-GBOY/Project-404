import type { PermissionDefinition } from "../../rbac/domain/permission.js";

export const organizationPermissions: PermissionDefinition[] = [
  { action: "read", resource: "organization", description: "View organizations" },
  { action: "create", resource: "organization", description: "Create an organization" },
  { action: "update", resource: "organization", description: "Update organization settings" },
  { action: "manage_members", resource: "organization", description: "Add or remove members" },
];
