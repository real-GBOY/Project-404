import type { RoleSeed as CoreRoleSeed } from "@core/rbac/domain/role.js";

/**
 * RBAC building blocks for the real-estate domain. `PermissionDefinition` and `permKey`
 * are Core's (`core/rbac/domain`), re-exported so `app/realestate` modules keep one
 * stable local import. Permission key format: `"<action>:<resource>"`.
 */
export type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export { permKey } from "@core/rbac/domain/permission.js";

/**
 * A role Atlas seeds into Core RBAC on boot: Core's `RoleSeed` plus Atlas-only display
 * metadata. Roles are global (only `user_roles` assignments are tenant-scoped); nothing
 * in the domain code branches on a role key, only on permissions.
 */
export interface RoleSeed extends CoreRoleSeed {
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
