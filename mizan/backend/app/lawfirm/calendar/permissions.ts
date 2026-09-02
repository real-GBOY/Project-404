import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/**
 * Permissions the Calendar module contributes to RBAC (§3.2). The calendar view
 * aggregates hearings, firm events and due-dated tasks; `event` here is a
 * free-standing firm calendar entry (meeting, filing deadline, reminder).
 */
export const calendarPermissions: PermissionDefinition[] = [
  { action: "read", resource: "calendar", description: "View the firm calendar" },
  { action: "create", resource: "event", description: "Add a calendar event" },
  { action: "update", resource: "event", description: "Edit a calendar event" },
  { action: "delete", resource: "event", description: "Delete a calendar event" },
];
