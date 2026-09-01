import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../../kernel/db/db.js";
import { readInTenant } from "../../kernel/db/db.js";
import { Conflict, NotFound } from "../../kernel/errors.js";
import { requireOrganizationId } from "../../kernel/tenant.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "../../kernel/tokens.js";
import type { IAuditLogger } from "../../contracts/index.js";
import type { Role } from "../domain/role.js";
import { parsePermissionKey, permissionKey } from "../domain/permission.js";
import { RbacRepository } from "../infrastructure/rbac-repository.js";

/** RBAC use cases (§7.2 start-here: User, Role, Permission, mappings, can()). */
@Injectable()
export class RbacService {
  constructor(
    private readonly repo: RbacRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  listRoles(): Promise<Role[]> {
    return this.repo.listRoles();
  }

  async createRole(input: { key: string; name: string; description?: string }): Promise<Role> {
    return this.uow.transaction(async () => {
      if (await this.repo.findRoleByKey(input.key)) {
        throw Conflict("rbac.role_exists", `A role with key "${input.key}" already exists.`);
      }
      const role = await this.repo.createRole(input);
      await this.audit.record({
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
    await this.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      await this.repo.assignRoleToUser(userId, role.id, orgId, grantedBy ?? null);
      await this.audit.record({
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
    await this.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      await this.repo.removeRoleFromUser(userId, role.id, orgId);
      await this.audit.record({
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
    await this.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      const permId = await this.repo.upsertPermission({ action, resource });
      await this.repo.grantPermissionToRole(role.id, permId);
      await this.audit.record({
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
    await this.uow.transaction(async () => {
      const role = await this.requireRole(roleKey);
      const permId = await this.repo.permissionIdByKey(key);
      if (permId) await this.repo.revokePermissionFromRole(role.id, permId);
    });
  }

  rolesForUser(userId: string, organizationId?: string): Promise<Role[]> {
    const orgId = organizationId ?? requireOrganizationId();
    return readInTenant(() => this.repo.rolesForUser(userId, orgId));
  }

  permissionsForUser(userId: string, organizationId?: string): Promise<string[]> {
    const orgId = organizationId ?? requireOrganizationId();
    return readInTenant(() => this.repo.permissionKeysForUser(userId, orgId));
  }

  private async requireRole(roleKey: string): Promise<Role> {
    const role = await this.repo.findRoleByKey(roleKey);
    if (!role) throw NotFound("rbac.role_not_found", `No role with key "${roleKey}".`);
    return role;
  }
}
