import type { PermissionDefinition } from "@admit/admit/shared/rbac.js";

export const eventsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "event", description: "View the events the person is assigned to." },
  { action: "read_all", resource: "event", description: "View every event of the organizer, not only assigned ones." },
  { action: "create", resource: "event", description: "Create events and venues." },
  { action: "update", resource: "event", description: "Edit events, venues, program and policies." },
  { action: "publish", resource: "event", description: "Publish, unpublish and cancel events." },
  { action: "manage", resource: "ticket_type", description: "Create and edit ticket types and inventory." },
  { action: "manage", resource: "payment_method", description: "Configure the manual payment instructions customers see." },
];
