/**
 * RBAC building blocks. `PermissionDefinition`, `permKey` and `RoleSeed` are Core's
 * (`core/rbac/domain`), re-exported so `app/raqib` keeps one stable local import. Core RBAC carries
 * only INFRASTRUCTURE permissions for Raqib (files, audit); what a person can do inside Raqib comes
 * from the per-organization permission templates (see `access/`).
 */
export type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export { permKey } from "@core/rbac/domain/permission.js";
export type { RoleSeed } from "@core/rbac/domain/role.js";
