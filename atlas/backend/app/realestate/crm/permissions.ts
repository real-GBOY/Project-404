import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const crmPermissions: PermissionDefinition[] = [
  { action: "read", resource: "lead", description: "View leads and the pipeline board." },
  { action: "create", resource: "lead", description: "Create leads." },
  { action: "update", resource: "lead", description: "Edit leads, change stage, track as a deal." },
  { action: "read", resource: "customer", description: "View customers." },
  { action: "create", resource: "customer", description: "Create customers." },
  { action: "update", resource: "customer", description: "Edit customers." },
  { action: "read", resource: "activity", description: "View the activity log." },
  { action: "create", resource: "activity", description: "Log an activity." },
  { action: "read", resource: "followup", description: "View followups." },
  { action: "create", resource: "followup", description: "Create followups." },
  { action: "update", resource: "followup", description: "Edit/close followups." },
];
