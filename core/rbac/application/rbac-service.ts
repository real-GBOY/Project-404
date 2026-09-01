import type { UnitOfWork } from "../../kernel/db/db.js";
import { readInTenant } from "../../kernel/db/db.js";
import { Conflict, NotFound } from "../../kernel/errors.js";
import { requireOrganizationId } from "../../kernel/tenant.js";
import type { IAuditLogger } from "../../contracts/index.js";
import type { Role } from "../domain/role.js";
import { parsePermissionKey, permissionKey } from "../domain/permission.js";
import type { RbacRepository } from "../infrastructure/rbac-repository.js";

export interface RbacServiceDeps {
  repo: RbacRepository;
  audit: IAuditLogger;
  uow: UnitOfWork;
}

/** RBAC use cases (§7.2 start-here: User, Role, Permission, mappings, can()). */
export class RbacService {
  constructor(private readonly d: RbacServiceDeps) {}

  listRoles(): Promise<Role[]> {
    return this.d.repo.listRoles();
  }

  async createRole(input: { key: string; name: string; description?: string }): Promise<Role> {
    return this.d.uow.transaction(async () => {
      if (await this.d.repo.findRoleByKey(input.key)) {
        throw Conflict("rbac.role_exists", `A role with key "${input.key}" already exists.`);
      }
      const role = await this.d.repo.createRole(input);
      await this.d.audit.record({
        actorId: null,
        actorType: "system",
        action: "rbac.role_created",
        resourceType: "role",
        resourceId: role.id,
        after: role,
      });
      return role;
    });
  }

  /**
   * Assign a role to a user *within a tenant*. `organizationId` defaults to the
   * active tenant; the org-creation flow passes the new org's id explicitly
   * (it runs system-context, with no active tenant).
   */
  async assignRole(
    userId: string,
    roleKey: string,
    grantedBy?: string,
    organizationId?: string,
  ): Promise<void> {
    const orgId = organizationId ?? requireOrganizationId();
    await this.d.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      await this.d.repo.assignRoleToUser(userId, role.id, orgId, grantedBy ?? null);
      await this.d.audit.record({
        actorId: grantedBy ?? null,
        actorType: grantedBy ? "user" : "system",
        action: "rbac.role_assigned",
        resourceType: "user",
        resourceId: userId,
        after: { roleKey, organizationId: orgId },
      });
    });
  }

  async removeRole(userId: string, roleKey: string, organizationId?: string): Promise<void> {
    const orgId = organizationId ?? requireOrganizationId();
    await this.d.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      await this.d.repo.removeRoleFromUser(userId, role.id, orgId);
      await this.d.audit.record({
        actorId: null,
        actorType: "system",
        action: "rbac.role_removed",
        resourceType: "user",
        resourceId: userId,
        after: { roleKey, organizationId: orgId },
      });
    });
  }

  async grantPermission(roleKey: string, action: string, resource: string): Promise<void> {
    await this.d.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      const permId = await this.d.repo.upsertPermission({ action, resource });
      await this.d.repo.grantPermissionToRole(role.id, permId);
      await this.d.audit.record({
        actorId: null,
        actorType: "system",
        action: "rbac.permission_granted",
        resourceType: "role",
        resourceId: role.id,
        after: { permission: permissionKey(action, resource) },
      });
    });
  }

  async revokePermission(roleKey: string, key: string): Promise<void> {
    const parsed = parsePermissionKey(key);
    if (!parsed) throw NotFound("rbac.bad_permission_key", `"${key}" is not a valid permission key.`);
    await this.d.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      const permId = await this.d.repo.permissionIdByKey(key);
      if (permId) await this.d.repo.revokePermissionFromRole(role.id, permId);
    });
  }

  rolesForUser(userId: string, organizationId?: string): Promise<Role[]> {
    const orgId = organizationId ?? requireOrganizationId();
    return readInTenant(() => this.d.repo.rolesForUser(userId, orgId));
  }

  permissionsForUser(userId: string, organizationId?: string): Promise<string[]> {
    const orgId = organizationId ?? requireOrganizationId();
    return readInTenant(() => this.d.repo.permissionKeysForUser(userId, orgId));
  }

  private async requireRole(roleKey: string): Promise<Role> {
    const role = await this.d.repo.findRoleByKey(roleKey);
    if (!role) throw NotFound("rbac.role_not_found", `No role with key "${roleKey}".`);
    return role;
  }
}
