import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const reservationsPermissions: PermissionDefinition[] = [
  {
    action: "read",
    resource: "reservation",
    description: "View reservations, availability and the booking calendar.",
  },
  { action: "create", resource: "reservation", description: "Create reservations." },
  {
    action: "update",
    resource: "reservation",
    description: "Confirm, change room or dates, and mark no-shows.",
  },
  { action: "cancel", resource: "reservation", description: "Cancel reservations." },
];
