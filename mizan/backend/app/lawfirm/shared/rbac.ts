/**
 * RBAC building blocks for the law-firm domain.
 *
 * The contracts (`PermissionDefinition`, `RoleSeed`, `permKey`) are Core's — see
 * `core/rbac/domain`. This file re-exports them so the law-firm modules keep one
 * stable local import; the permissions and roles themselves stay in this product.
 *
 * Permission key format: `"<action>:<resource>"` (e.g. `create:matter`).
 */
export type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export type { RoleSeed } from "@core/rbac/domain/role.js";
export { permKey } from "@core/rbac/domain/permission.js";
