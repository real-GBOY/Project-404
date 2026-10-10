import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { Conflict } from "@core/kernel/errors.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { ADMIT_ROLES } from "@admit/admit/shared/roles.js";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  membershipRole: string;
  roles: Array<{ key: string; name: string }>;
}

const ADMIT_ROLE_KEYS = new Set(ADMIT_ROLES.map((r) => r.key));

/**
 * The people of the organizer and what they may do: members with their Admit roles, and the role-by-permission matrix the Staff &
 * roles screen draws. Reading needs `manage:event_staff`. Adding someone and giving a role needs both `manage_members:organization`
 * and `assign:role` (the owner), because it widens who can touch payments. AURIC has no invitation flow, so the owner either adds
 * an account that already exists or creates one on the person's behalf (name + a starting password they hand over).
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly access: EventAccess,
    private readonly orgs: OrganizationService,
    private readonly rbac: RbacService,
    private readonly identity: IdentityService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async overview(who: Principal) {
    return readInTenant(async () => {
      await this.access.require(who, "manage", "event_staff");
      const orgId = requireOrganizationId();
      const db = currentExecutor();
      const members = await db
        .selectFrom("organization_members as m")
        .innerJoin("users as u", "u.id", "m.user_id")
        .select(["m.user_id", "m.membership_role", "u.display_name", "u.email"])
        .where("m.organization_id", "=", orgId)
        .orderBy("m.joined_at")
        .execute();
      const assigned = await db
        .selectFrom("user_roles as ur")
        .innerJoin("roles as r", "r.id", "ur.role_id")
        .select(["ur.user_id", "r.key", "r.name"])
        .where("ur.organization_id", "=", orgId)
        .execute();
      const roles = await db
        .selectFrom("roles as r")
        .leftJoin("role_permissions as rp", "rp.role_id", "r.id")
        .leftJoin("permissions as p", "p.id", "rp.permission_id")
        .select(["r.key", "r.name", "r.description", sql<string[]>`coalesce(array_agg(p.key) filter (where p.key is not null), '{}')`.as("permissions")])
        .where("r.key", "in", [...ADMIT_ROLE_KEYS])
        .groupBy(["r.key", "r.name", "r.description"])
        .execute();
      const order = ["owner", "event_manager", "finance_reviewer", "door_staff", "viewer"];
      return {
        members: members.map<TeamMember>((m) => ({
          userId: m.user_id,
          name: m.display_name ?? m.email,
          email: m.email,
          membershipRole: m.membership_role,
          roles: assigned.filter((a) => a.user_id === m.user_id && ADMIT_ROLE_KEYS.has(a.key)).map((a) => ({ key: a.key, name: a.name })),
        })),
        roles: roles
          .map((r) => ({ key: r.key, name: r.name, description: r.description ?? "", permissions: r.permissions }))
          .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)),
      };
    });
  }

  /** The owner sets a colleague's password (a starting password to hand over). Their sessions end. */
  async setMemberPassword(who: Principal, userId: string, newPassword: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.access.require(who, "manage_members", "organization");
      await this.access.require(who, "assign", "role");
      const member = await currentExecutor()
        .selectFrom("organization_members")
        .select("user_id")
        .where("organization_id", "=", requireOrganizationId())
        .where("user_id", "=", userId)
        .executeTakeFirst();
      if (!member) throw NotFound("admit.member_not_found", "That person is not on the team.");
      await this.identity.setPassword(userId, newPassword, who.userId);
      await this.audit.record({ actorId: who.userId, action: "admit.team.password_reset", resourceType: "user", resourceId: userId });
    });
  }

  /** Anyone signed in changes their own password. */
  async changeOwnPassword(who: Principal, currentPassword: string, newPassword: string): Promise<void> {
    await this.identity.changePassword(who.userId, currentPassword, newPassword);
  }

  /** Add an account to the organizer with an Admit role, creating the account first when `account` is given and the email is new. */
  async add(who: Principal, email: string, roleKey: string, account?: { name: string; password: string }): Promise<void> {
    if (!ADMIT_ROLE_KEYS.has(roleKey)) throw ValidationError("admit.unknown_role", "Choose one of the Admit roles.");
    await this.uow.transaction(async () => {
      await this.access.require(who, "manage_members", "organization");
      await this.access.require(who, "assign", "role");
      let user = await currentExecutor()
        .selectFrom("users")
        .select(["id", "email"])
        .where("email_normalized", "=", email.trim().toLowerCase())
        .executeTakeFirst();
      let created = false;
      if (!user) {
        if (!account)
          throw NotFound("admit.no_account", "No account uses that email. Create one for them (name and a starting password), or ask them to register first.");
        const u = await this.identity.register({ email, password: account.password, displayName: account.name });
        user = { id: u.id, email };
        created = true;
      }
      try {
        await this.orgs.addMember({ organizationId: requireOrganizationId(), userId: user.id, actorId: who.userId });
      } catch (err) {
        if (!(err instanceof Error) || (err as { code?: string }).code !== "organizations.already_member") throw err;
      }
      await this.rbac.assignRole(user.id, roleKey, who.userId);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.team.added",
        resourceType: "user",
        resourceId: user.id,
        after: { roleKey, accountCreated: created },
      });
    });
  }

  /**
   * Take a person out of the organizer: every Admit role, every event assignment, then the membership itself. Never yourself, and never the
   * last owner, so the organizer cannot lock itself out. Their account and everything they did (audit trail, scans, decisions) stays.
   */
  async removeMember(who: Principal, userId: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.access.require(who, "manage_members", "organization");
      await this.access.require(who, "assign", "role");
      if (userId === who.userId) throw Conflict("admit.cannot_remove_self", "You cannot remove yourself. Ask another owner to do it.");
      const orgId = requireOrganizationId();
      const db = currentExecutor();
      const member = await db
        .selectFrom("organization_members")
        .select("user_id")
        .where("organization_id", "=", orgId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      if (!member) throw NotFound("admit.member_not_found", "That person is not on the team.");
      const roles = await db
        .selectFrom("user_roles as ur")
        .innerJoin("roles as r", "r.id", "ur.role_id")
        .select("r.key")
        .where("ur.organization_id", "=", orgId)
        .where("ur.user_id", "=", userId)
        .execute();
      if (roles.some((r) => r.key === "owner") && (await this.ownerCount()) <= 1) throw Conflict("admit.last_owner", "An organizer needs at least one owner.");
      for (const r of roles) await this.rbac.removeRole(userId, r.key);
      await admitDb().deleteFrom("admit_event_staff").where("user_id", "=", userId).execute();
      await this.orgs.removeMember(orgId, userId, who.userId);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.team.removed",
        resourceType: "user",
        resourceId: userId,
        before: { roles: roles.map((r) => r.key) },
      });
    });
  }

  private async ownerCount(): Promise<number> {
    const r = await currentExecutor()
      .selectFrom("user_roles as ur")
      .innerJoin("roles as r", "r.id", "ur.role_id")
      .select(sql<string>`count(*)`.as("n"))
      .where("r.key", "=", "owner")
      .where("ur.organization_id", "=", requireOrganizationId())
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  /** Take an Admit role away. A person can never remove their own last way in: the owner role stays on at least one account. */
  async removeRole(who: Principal, userId: string, roleKey: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.access.require(who, "assign", "role");
      if (roleKey === "owner" && (await this.ownerCount()) <= 1) throw Conflict("admit.last_owner", "An organizer needs at least one owner.");
      await this.rbac.removeRole(userId, roleKey);
      await this.audit.record({ actorId: who.userId, action: "admit.team.role_removed", resourceType: "user", resourceId: userId, before: { roleKey } });
    });
  }
}
