import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const staffPermissions: PermissionDefinition[] = [
  { action: "read", resource: "staff", description: "View the staff directory and roles." },
  {
    action: "manage",
    resource: "staff",
    description: "Add staff, change their role or remove them from the hotel.",
  },
];
