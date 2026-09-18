import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

/**
 * Conversation insights are DERIVED from a conversation, so reading them also
 * requires being a member of it (Core messaging enforces that). These permissions
 * are the coarse gate on top; applying an insight to CRM data additionally needs the
 * underlying permission (`update:lead`, `create:followup`) — an AI suggestion can
 * never do what its user could not.
 */
export const conversationIntelligencePermissions: PermissionDefinition[] = [
  { action: "read", resource: "conversation_insight", description: "View AI insights for conversations you belong to." },
  { action: "apply", resource: "conversation_insight", description: "Apply an AI insight to CRM data (lead requirements, follow-ups)." },
];
