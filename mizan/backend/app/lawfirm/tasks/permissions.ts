import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/** Permissions the Tasks module contributes to RBAC (§3.2). Tasks include court/statutory deadlines. */
export const taskPermissions: PermissionDefinition[] = [
  { action: "read", resource: "task", description: "View tasks and deadlines" },
  { action: "create", resource: "task", description: "Create a task or deadline" },
  { action: "update", resource: "task", description: "Edit a task or deadline" },
  { action: "assign", resource: "task", description: "Assign a task to a team member" },
  { action: "complete", resource: "task", description: "Mark a task complete or reopen it" },
];
