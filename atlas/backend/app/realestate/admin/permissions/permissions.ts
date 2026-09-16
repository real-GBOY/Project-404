import type { PermissionDefinition } from "@atlas/realestate/shared/rbac.js";

/**
 * Team, Roles & Permissions, Audit Logs and Notifications are thin adapters
 * over Core's own RBAC/Identity/Audit/Notifications resources (`role`,
 * `organization`, `audit_log`, …) — see `shared/roles.ts`'s `CORE_ADMIN_KEYS`.
 * The only new resource here is Atlas's own org-level settings.
 */
export const adminPermissions: PermissionDefinition[] = [
  { action: "read", resource: "org_setting", description: "View organization settings." },
  { action: "update", resource: "org_setting", description: "Edit organization settings." },
];
