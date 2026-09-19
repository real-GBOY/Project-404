export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

/** Reserved role keys the Core seeds on every deployment. */
export const SYSTEM_ROLES = {
  /** Full access — "*:*". Assigned to the bootstrap admin. */
  admin: "admin",
} as const;

/**
 * A role an application seeds into Core RBAC on boot. Deliberately minimal — the
 * mechanism (`seedRbacDefinitions`) needs nothing more. What the roles ARE, which
 * permissions they hold, and any extra per-role data (an application can extend this
 * interface) belong to the application, never to Core.
 *
 * Roles are global (per docs/tenancy.md — only `user_roles` assignments are
 * tenant-scoped). Domain code never branches on a role key; it checks permissions.
 */
export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  /** `"<action>:<resource>"` keys granted to the role. */
  permissionKeys: string[];
}
