import type { UnitOfWork } from "../../kernel/db/db.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import { SYSTEM_ROLES } from "../domain/role.js";
import type { PermissionDefinition } from "../domain/permission.js";
import type { RbacRepository } from "../infrastructure/rbac-repository.js";

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
