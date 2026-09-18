import type { PermissionDefinition } from "@core/rbac/domain/permission.js";

/**
 * Coarse RBAC gates. They answer "may this user use messaging at all?".
 * Fine-grained access — "is this user IN this conversation?" — is always a
 * membership check in the service; a permission alone never opens a conversation.
 */
export const messagingPermissions: PermissionDefinition[] = [
  { action: "read", resource: "conversation", description: "List and read conversations you belong to." },
  { action: "create", resource: "conversation", description: "Start conversations and manage the ones you own." },
  { action: "send", resource: "message", description: "Send, edit and delete your own messages; react." },
  { action: "moderate", resource: "message", description: "Delete other people's messages in conversations you belong to." },
];
