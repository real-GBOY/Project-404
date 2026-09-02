/**
 * RBAC building blocks for the law-firm domain.
 *
 * `PermissionDefinition` is structurally identical to Core's
 * (`core/rbac/domain/permission.ts`) and is accepted by
 * `RbacRepository.upsertPermission` via structural typing. It is redeclared here
 * so `app/lawfirm` modules don't import a Core internal for a plain data shape.
 *
 * Permission key format matches Core: `"<action>:<resource>"` (e.g. `create:matter`).
 */
export interface PermissionDefinition {
  action: string;
  resource: string;
  description?: string;
}

export const permKey = (p: PermissionDefinition): string => `${p.action}:${p.resource}`;

/**
 * A role the client app seeds into Core RBAC on boot. Roles are global
 * (per docs/tenancy.md — only `user_roles` assignments are tenant-scoped) and
 * remain editable through the Core `/api/rbac` endpoints; nothing in the domain
 * code branches on a role key, only on permissions.
 */
export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  /** `"<action>:<resource>"` keys granted to the role. */
  permissionKeys: string[];
}
