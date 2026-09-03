import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/**
 * Permissions the Matters module contributes to RBAC (§3.2). Covers the matter
 * aggregate: the matter itself, its participants (assignment), its timeline
 * updates, and its internal notes.
 */
export const matterPermissions: PermissionDefinition[] = [
  { action: "read", resource: "matter", description: "View matters and their overview/timeline" },
  { action: "create", resource: "matter", description: "Open a new matter" },
  {
    action: "update",
    resource: "matter",
    description: "Edit matter details and post timeline updates",
  },
  { action: "close", resource: "matter", description: "Close a matter" },
  { action: "assign", resource: "matter", description: "Add or remove matter participants" },
  { action: "read", resource: "matter_note", description: "Read a matter's internal notes" },
  {
    action: "write",
    resource: "matter_note",
    description: "Add or edit a matter's internal notes",
  },
];
