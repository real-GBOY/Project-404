import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const pricingPermissions: PermissionDefinition[] = [
  { action: "read", resource: "rate", description: "View rate rules and discount codes." },
  {
    action: "manage",
    resource: "rate",
    description: "Create and retire rate rules and discount codes.",
  },
];
