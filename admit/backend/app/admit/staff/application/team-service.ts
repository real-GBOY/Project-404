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
 * and `assign:role` (the owner), because it widens who can touch payments. Only an account that already exists can be added: AURIC
 * has no invitation flow, so the person registers first (documented limitation).
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly access: EventAccess,
    private readonly orgs: OrganizationService,
    private readonly rbac: RbacService,
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

  /** Add an existing account to the organizer with an Admit role. */
  async add(who: Principal, email: string, roleKey: string): Promise<void> {
    if (!ADMIT_ROLE_KEYS.has(roleKey)) throw ValidationError("admit.unknown_role", "Choose one of the Admit roles.");
    await this.uow.transaction(async () => {
      await this.access.require(who, "manage_members", "organization");
      await this.access.require(who, "assign", "role");
      const user = await currentExecutor()
        .selectFrom("users")
        .select(["id", "email"])
        .where("email_normalized", "=", email.trim().toLowerCase())
        .executeTakeFirst();
      if (!user) throw NotFound("admit.no_account", "No account uses that email. Ask them to register first, then add them here.");
      try {
        await this.orgs.addMember({ organizationId: requireOrganizationId(), userId: user.id, actorId: who.userId });
      } catch (err) {
        if (!(err instanceof Error) || (err as { code?: string }).code !== "organizations.already_member") throw err;
      }
      await this.rbac.assignRole(user.id, roleKey, who.userId);
      await this.audit.record({ actorId: who.userId, action: "admit.team.added", resourceType: "user", resourceId: user.id, after: { roleKey } });
    });
  }

  /** Take an Admit role away. A person can never remove their own last way in: the owner role stays on at least one account. */
  async removeRole(who: Principal, userId: string, roleKey: string): Promise<void> {
    await this.uow.transaction(async () => {
      await this.access.require(who, "assign", "role");
      if (roleKey === "owner") {
        const owners = await currentExecutor()
          .selectFrom("user_roles as ur")
          .innerJoin("roles as r", "r.id", "ur.role_id")
          .select(sql<string>`count(*)`.as("n"))
          .where("r.key", "=", "owner")
          .where("ur.organization_id", "=", requireOrganizationId())
          .executeTakeFirstOrThrow();
        if (Number(owners.n) <= 1) throw Conflict("admit.last_owner", "An organizer needs at least one owner.");
      }
      await this.rbac.removeRole(userId, roleKey);
      await this.audit.record({ actorId: who.userId, action: "admit.team.role_removed", resourceType: "user", resourceId: userId, before: { roleKey } });
    });
  }
}
