import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import { HOTEL_PERMISSIONS } from "@hotel/hotel/permissions.js";
import { permKey } from "@hotel/hotel/shared/rbac.js";
import { HOTEL_ROLES, HOTEL_ROLE_KEYS, OWNER_ROLE_KEY } from "@hotel/hotel/shared/roles.js";
import { StaffRepository } from "../infrastructure/staff-repository.js";

const ROLE_NAMES = new Map(HOTEL_ROLES.map((r) => [r.key, r.name]));

/**
 * Staff directory + role assignment for one hotel, as an adapter over Core identity,
 * organizations and RBAC — HotelOS creates no second user or role system. Guard rails against
 * privilege escalation live here, server-side:
 *   - only a holder of `manage:role` (the owner) may grant or take away the owner role, checked
 *     against LIVE permissions rather than the token's baked-in claims;
 *   - nobody changes their own role or removes themselves;
 *   - a hotel always keeps at least one owner.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly identity: IdentityService,
    private readonly orgs: OrganizationService,
    private readonly rbac: RbacService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list() {
    const rows = await readInTenant(() => this.repo.members());
    return rows.map((m) => ({
      userId: m.userId,
      name: m.name ?? m.email,
      email: m.email,
      roleKey: m.roleKey,
      roleName: m.roleKey ? (ROLE_NAMES.get(m.roleKey) ?? m.roleKey) : null,
      status: m.userStatus,
      joinedAt: m.joinedAt,
      lastActiveAt: m.lastActiveAt,
    }));
  }

  /** The caller's own hotel role — for the topbar ("Mona Farid · Manager"). */
  async myRole(userId: string) {
    const keys = await readInTenant(() => this.repo.hotelRoleKeysFor(userId));
    const key = keys[0] ?? null;
    return { roleKey: key, roleName: key ? (ROLE_NAMES.get(key) ?? key) : null };
  }

  /**
   * Read-only permission matrix. Core roles are global to the deployment (only assignments are
   * tenant-scoped), so letting one hotel edit a role would change it for every hotel — a
   * cross-tenant privilege change. Editing needs per-tenant roles in Core first.
   */
  async roles() {
    const granted = await readInTenant(() => this.repo.rolePermissionKeys());
    return {
      permissions: HOTEL_PERMISSIONS.map((p) => ({
        key: permKey(p),
        action: p.action,
        resource: p.resource,
        description: p.description ?? null,
      })),
      roles: HOTEL_ROLES.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description ?? null,
        permissionKeys: (granted.get(r.key) ?? []).sort(),
      })),
    };
  }

  add(
    input: { fullName: string; email: string; roleKey: string; temporaryPassword: string },
    actorId: string,
  ) {
    this.requireHotelRole(input.roleKey);
    return this.uow.transaction(async () => {
      await this.requireMayGrant(input.roleKey, actorId);
      const organizationId = requireOrganizationId();
      const user = await this.identity.register({
        email: input.email,
        password: input.temporaryPassword,
        displayName: input.fullName,
        locale: "en",
      });
      await this.orgs.addMember({ organizationId, userId: user.id, actorId });
      await this.rbac.assignRole(user.id, input.roleKey, actorId, organizationId);
      await this.audit.record({
        actorId,
        action: "hotel.staff.added",
        resourceType: "user",
        resourceId: user.id,
        after: { roleKey: input.roleKey },
      });
      return { userId: user.id, status: user.status };
    });
  }

  changeRole(userId: string, roleKey: string, actorId: string) {
    this.requireHotelRole(roleKey);
    if (userId === actorId) {
      throw Forbidden("staff.self_role_change", "You can't change your own role.");
    }
    return this.uow.transaction(async () => {
      if (!(await this.repo.isMember(userId))) {
        throw NotFound("staff.not_found", "That person is not on this hotel's staff.");
      }
      const current = await this.repo.hotelRoleKeysFor(userId);
      if (current.length === 1 && current[0] === roleKey) return { ok: true };
      if (current.includes(OWNER_ROLE_KEY) || roleKey === OWNER_ROLE_KEY) {
        await this.requireMayGrant(OWNER_ROLE_KEY, actorId);
      }
      if (current.includes(OWNER_ROLE_KEY) && roleKey !== OWNER_ROLE_KEY) {
        await this.requireAnotherOwner();
      }
      for (const key of current) {
        if (key !== roleKey) await this.rbac.removeRole(userId, key);
      }
      if (!current.includes(roleKey)) {
        await this.rbac.assignRole(userId, roleKey, actorId);
      }
      await this.audit.record({
        actorId,
        action: "hotel.staff.role_changed",
        resourceType: "user",
        resourceId: userId,
        before: { roleKeys: current },
        after: { roleKey },
      });
      return { ok: true };
    });
  }

  remove(userId: string, actorId: string) {
    if (userId === actorId) {
      throw Forbidden("staff.self_removal", "You can't remove yourself from the hotel.");
    }
    return this.uow.transaction(async () => {
      if (!(await this.repo.isMember(userId))) {
        throw NotFound("staff.not_found", "That person is not on this hotel's staff.");
      }
      const current = await this.repo.hotelRoleKeysFor(userId);
      if (current.includes(OWNER_ROLE_KEY)) {
        await this.requireMayGrant(OWNER_ROLE_KEY, actorId);
        await this.requireAnotherOwner();
      }
      for (const key of current) await this.rbac.removeRole(userId, key);
      await this.orgs.removeMember(requireOrganizationId(), userId, actorId);
      await this.audit.record({
        actorId,
        action: "hotel.staff.removed",
        resourceType: "user",
        resourceId: userId,
        before: { roleKeys: current },
      });
      return { ok: true };
    });
  }

  private requireHotelRole(roleKey: string): void {
    if (!HOTEL_ROLE_KEYS.includes(roleKey)) {
      throw ValidationError("staff.unknown_role", `Unknown role "${roleKey}".`);
    }
  }

  /** Live RBAC check (not the token's claims, which can be minutes stale), like PermissionGuard. */
  private async requireMayGrant(roleKey: string, actorId: string): Promise<void> {
    if (roleKey !== OWNER_ROLE_KEY) return;
    const held = await this.rbac.permissionsForUser(actorId);
    if (!held.some((k) => permissionMatches(k, "manage", "role"))) {
      throw Forbidden("staff.owner_role_restricted", "Only an owner can grant or revoke Owner.");
    }
  }

  private async requireAnotherOwner(): Promise<void> {
    if ((await this.repo.countWithRole(OWNER_ROLE_KEY)) <= 1) {
      throw Conflict("staff.last_owner", "A hotel must keep at least one owner.");
    }
  }
}
