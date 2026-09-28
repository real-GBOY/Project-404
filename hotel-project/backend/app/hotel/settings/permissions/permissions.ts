import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const settingsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "hotel_settings", description: "View hotel settings." },
  {
    action: "update",
    resource: "hotel_settings",
    description: "Change hotel settings (times, tax).",
  },
];
