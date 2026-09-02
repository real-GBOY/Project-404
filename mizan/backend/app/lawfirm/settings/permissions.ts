import type { PermissionDefinition } from "../shared/rbac.js";

/**
 * Permissions the Settings module contributes to RBAC (§3.2). Firm profile,
 * matter types, courts, billing rates and the AI toggle live in
 * `organizations.settings`. "Users & roles" defers to Core `/api/rbac`,
 * "Security & audit log" to Core `/api/audit-logs`, "Language & region" to Core
 * localization.
 */
export const settingsPermissions: PermissionDefinition[] = [
  { action: "read", resource: "lawfirm_setting", description: "View firm settings" },
  { action: "manage", resource: "lawfirm_setting", description: "Edit firm settings, matter types, courts and rates" },
];
