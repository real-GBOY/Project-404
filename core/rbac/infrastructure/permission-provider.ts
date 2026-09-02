import { Injectable } from "@nestjs/common";
import type { IPermissionProvider } from "@core/contracts/index.js";
import { currentOrganizationId, requireOrganizationId } from "@core/kernel/tenant.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import { RbacRepository } from "./rbac-repository.js";

/**
 * RBAC's implementation of the IPermissionProvider contract (§4). This is how
 * every module and the HTTP layer answer "can this user do this?" — always
 * against live data, so a revoked role takes effect immediately.
 *
 * Multi-tenant (§ docs/tenancy.md): permissions are resolved *within the active
 * tenant* — a user can be admin in one org and read-only in another. No active
 * tenant → no permissions. Callers outside a transaction (a Fastify `preHandler`
 * guard) wrap the call in `readInTenant` so RLS on `user_roles` is in force.
 */
@Injectable()
export class RbacPermissionProvider implements IPermissionProvider {
  constructor(private readonly repo: RbacRepository) {}

  async can(userId: string, action: string, resource: string): Promise<boolean> {
    const org = currentOrganizationId();
    if (!org) return false;
    const held = await this.repo.permissionKeysForUser(userId, org);
    return held.some((key) => permissionMatches(key, action, resource));
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.repo.assignRoleToUser(userId, roleId, requireOrganizationId());
  }

  async permissionsFor(userId: string): Promise<string[]> {
    const org = currentOrganizationId();
    if (!org) return [];
    return this.repo.permissionKeysForUser(userId, org);
  }
}
