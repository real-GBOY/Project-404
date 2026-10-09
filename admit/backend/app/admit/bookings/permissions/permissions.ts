import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const bookingsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "booking", description: "Inspect bookings, their timeline, tickets and emails." },
  { action: "cancel", resource: "booking", description: "Cancel a booking (revokes its tickets)." },
];
