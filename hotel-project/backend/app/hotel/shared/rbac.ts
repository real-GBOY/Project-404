/**
 * RBAC building blocks for the hotel domain. `PermissionDefinition`, `permKey` and `RoleSeed` are
 * Core's (`core/rbac/domain`), re-exported so `app/hotel` modules keep one stable local import.
 * Permission key format: `"<action>:<resource>"` (e.g. `create:reservation`).
 */
export type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export { permKey } from "@core/rbac/domain/permission.js";
export type { RoleSeed } from "@core/rbac/domain/role.js";
