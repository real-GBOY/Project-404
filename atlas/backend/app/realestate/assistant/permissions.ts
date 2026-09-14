import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

export const assistantPermissions: PermissionDefinition[] = [
  { action: "read", resource: "ai_conversation", description: "View AI Copilot conversations." },
  { action: "ask", resource: "ai_conversation", description: "Ask the AI Copilot a question." },
  { action: "read", resource: "ai_insight", description: "View AI insights and recommendations." },
  { action: "dismiss", resource: "ai_insight", description: "Dismiss an AI insight." },
];
