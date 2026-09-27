import type { PermissionDefinition } from "@hotel/hotel/shared/rbac.js";

export const roomsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "room", description: "View rooms, room types and room status." },
  {
    action: "manage",
    resource: "room",
    description: "Create, edit and archive rooms and room types.",
  },
];
