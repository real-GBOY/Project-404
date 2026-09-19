import type { UnitOfWork } from "@core/kernel/db/db.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { SYSTEM_ROLES, type RoleSeed } from "@core/rbac/domain/role.js";
import { parsePermissionKey, type PermissionDefinition } from "@core/rbac/domain/permission.js";
import type { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";

const log = moduleLogger("rbac");

/**
 * Idempotent RBAC bootstrap, run at startup. Registers every permission each
 * module declares (§3.2 permissions/) and ensures the system `admin` role
 * exists holding "*:*". Safe to run on every boot.
 */
export async function seedRbac(
  repo: RbacRepository,
  uow: UnitOfWork,
  modulePermissions: PermissionDefinition[],
): Promise<void> {
  await uow.transaction(async () => {
    for (const def of modulePermissions) {
      await repo.upsertPermission(def);
    }

    let admin = await repo.findRoleByKey(SYSTEM_ROLES.admin);
    admin ??= await repo.createRole({
      key: SYSTEM_ROLES.admin,
      name: "Administrator",
      description: "Full access to everything.",
      isSystem: true,
    });

    const wildcard = await repo.upsertPermission({
      action: "*",
      resource: "*",
      description: "Superuser wildcard",
    });
    await repo.grantPermissionToRole(admin.id, wildcard);
  });

  log.info({ permissions: modulePermissions.length }, "RBAC seeded");
}

/**
 * Registers an application's own permissions and starting roles. Idempotent, and ONE
 * transaction: a role that references a malformed permission key aborts the whole seed
 * rather than leaving half of it applied.
 *
 * Roles are seeded as system roles (`isSystem: true`) and remain editable through the
 * Core `/api/rbac` endpoints. An existing role is left as it is (its name/description are
 * not overwritten); its permission grants are (re)applied — additively, never revoked.
 *
 * Tenancy context is the CALLER's choice: seeding touches global tables, so callers run
 * it in system context (`runAsSystem`), exactly as `SeedService` does for Core's own seed.
 */
export async function seedRbacDefinitions(
  repo: RbacRepository,
  uow: UnitOfWork,
  definitions: { permissions: PermissionDefinition[]; roles: RoleSeed[] },
): Promise<void> {
  await uow.transaction(async () => {
    for (const def of definitions.permissions) {
      await repo.upsertPermission(def);
    }

    for (const role of definitions.roles) {
      let stored = await repo.findRoleByKey(role.key);
      stored ??= await repo.createRole({
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      });

      for (const key of role.permissionKeys) {
        const parsed = parsePermissionKey(key);
        if (!parsed) {
          throw new Error(`seedRbacDefinitions: invalid permission key "${key}" on role "${role.key}"`);
        }
        const permId = await repo.upsertPermission(parsed);
        await repo.grantPermissionToRole(stored.id, permId);
      }
    }
  });
}
