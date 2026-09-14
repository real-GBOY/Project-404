/**
 * RBAC building blocks for the real-estate domain — structurally identical to
 * Core's (`core/rbac/domain/permission.ts`) and to Mizan's
 * (`mizan/backend/app/lawfirm/shared/rbac.ts`), redeclared here so
 * `app/realestate` modules don't reach into a Core internal for a plain data
 * shape. Permission key format matches Core: `"<action>:<resource>"`.
 */
export interface PermissionDefinition {
  action: string;
  resource: string;
  description?: string;
}

export const permKey = (p: PermissionDefinition): string => `${p.action}:${p.resource}`;

/**
 * A role the Atlas app seeds into Core RBAC on boot. Roles are global (only
 * `user_roles` assignments are tenant-scoped); nothing in the domain code
 * branches on a role key, only on permissions.
 */
export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  /** `"<action>:<resource>"` keys granted to the role. */
  permissionKeys: string[];
  /**
   * Pure display copy for the Roles & Permissions screen (`dataScope` /
   * `discountAuthority` / `canApprove` in the frontend fixture) — descriptive
   * only, not enforced by any check. Kept next to the role definition instead
   * of a DB column since nothing computes from it.
   */
  meta: {
    dataScope: string;
    discountAuthority: string;
    canApprove: string;
  };
}
