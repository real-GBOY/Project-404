import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const propertiesPermissions: PermissionDefinition[] = [
  { action: "read", resource: "project", description: "View projects." },
  { action: "create", resource: "project", description: "Create projects." },
  { action: "update", resource: "project", description: "Edit projects." },
  { action: "read", resource: "building", description: "View buildings." },
  { action: "create", resource: "building", description: "Create buildings." },
  { action: "update", resource: "building", description: "Edit buildings." },
  { action: "read", resource: "unit", description: "View unit inventory." },
  { action: "update", resource: "unit", description: "Edit unit status/details." },
  { action: "read", resource: "price_list", description: "View price lists." },
  { action: "create", resource: "price_list", description: "Create price lists." },
  { action: "update", resource: "price_list", description: "Edit price lists." },
];
