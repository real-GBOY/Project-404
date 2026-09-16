import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const operationsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "task", description: "View tasks." },
  { action: "create", resource: "task", description: "Create tasks." },
  { action: "update", resource: "task", description: "Edit/complete tasks." },
  { action: "read", resource: "workflow", description: "View workflows." },
  { action: "create", resource: "workflow", description: "Create workflows." },
  { action: "read", resource: "approval", description: "View approvals." },
  { action: "create", resource: "approval", description: "Request an approval." },
  { action: "approve", resource: "approval", description: "Approve or reject a pending approval step." },
  { action: "read", resource: "document", description: "View documents." },
  { action: "upload", resource: "document", description: "Upload a document." },
];
