import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import type { Role } from "@core/rbac/domain/role.js";
import { permissionKey, type PermissionDefinition } from "@core/rbac/domain/permission.js";

/**
 * Storage for roles, permissions, and their assignments. One place knows the
 * schema (§3.4); the permission provider and the RBAC service both go through
 * here.
 */
@Injectable()
export class RbacRepository {
  async findRoleByKey(key: string): Promise<Role | null> {
    const row = await currentExecutor()
      .selectFrom("roles")
      .selectAll()
      .where("key", "=", key)
      .executeTakeFirst();
    return row ? this.toRole(row) : null;
  }

  async listRoles(): Promise<Role[]> {
    const rows = await currentExecutor().selectFrom("roles").selectAll().orderBy("key").execute();
    return rows.map((r) => this.toRole(r));
  }

  async createRole(input: {
    key: string;
    name: string;
    description?: string | null;
    isSystem?: boolean;
  }): Promise<Role> {
    const id = newId("role");
    await currentExecutor()
      .insertInto("roles")
      .values({
        id,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        is_system: input.isSystem ?? false,
      })
      .execute();
    return {
      id,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      isSystem: input.isSystem ?? false,
    };
  }

  async upsertPermission(def: PermissionDefinition): Promise<string> {
    const key = permissionKey(def.action, def.resource);
    const existing = await currentExecutor()
      .selectFrom("permissions")
      .select("id")
      .where("key", "=", key)
      .executeTakeFirst();
    if (existing) return existing.id;

    const id = newId("perm");
    await currentExecutor()
      .insertInto("permissions")
      .values({
        id,
        key,
        action: def.action,
        resource: def.resource,
        description: def.description ?? null,
      })
      .onConflict((oc) => oc.column("key").doNothing())
      .execute();

    const row = await currentExecutor()
      .selectFrom("permissions")
      .select("id")
      .where("key", "=", key)
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async grantPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await currentExecutor()
      .insertInto("role_permissions")
      .values({ role_id: roleId, permission_id: permissionId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("role_permissions")
      .where("role_id", "=", roleId)
      .where("permission_id", "=", permissionId)
      .execute();
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    organizationId: string,
    grantedBy?: string | null,
  ): Promise<void> {
    await currentExecutor()
      .insertInto("user_roles")
      .values({
        user_id: userId,
        role_id: roleId,
        organization_id: organizationId,
        granted_by: grantedBy ?? null,
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async removeRoleFromUser(userId: string, roleId: string, organizationId: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("user_roles")
      .where("user_id", "=", userId)
      .where("role_id", "=", roleId)
      .where("organization_id", "=", organizationId)
      .execute();
  }

  /** Roles the user holds in the given tenant. */
  async rolesForUser(userId: string, organizationId: string): Promise<Role[]> {
    const rows = await currentExecutor()
      .selectFrom("user_roles")
      .innerJoin("roles", "roles.id", "user_roles.role_id")
      .where("user_roles.user_id", "=", userId)
      .where("user_roles.organization_id", "=", organizationId)
      .selectAll("roles")
      .execute();
    return rows.map((r) => this.toRole(r));
  }

  /**
   * Every permission key the user holds in the given tenant, via any of their
   * roles there. RLS also scopes `user_roles`; the explicit filter is defence
   * in depth and keeps the query correct when run via the system role.
   */
  async permissionKeysForUser(userId: string, organizationId: string): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("user_roles")
      .innerJoin("role_permissions", "role_permissions.role_id", "user_roles.role_id")
      .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
      .where("user_roles.user_id", "=", userId)
      .where("user_roles.organization_id", "=", organizationId)
      .select("permissions.key")
      .distinct()
      .execute();
    return rows.map((r) => r.key);
  }

  async permissionIdByKey(key: string): Promise<string | null> {
    const row = await currentExecutor()
      .selectFrom("permissions")
      .select("id")
      .where("key", "=", key)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  private toRole(row: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    is_system: boolean;
  }): Role {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
    };
  }
}
