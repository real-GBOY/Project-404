import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK, USER_PROVIDER } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IUserProvider } from "@core/contracts/index.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { getContext } from "@core/kernel/logging/context.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { ALL_PROJECT_ROLES, ROLE_KEYS, type RoleKey } from "@raqib/raqib/shared/modules.js";
import { initials } from "@raqib/raqib/shared/l10n.js";
import { coreRoleKey } from "@raqib/raqib/shared/roles.js";
import type { PersonView } from "../domain/person.js";
import { PeopleRepository, type ProfileRecord } from "../infrastructure/people-repository.js";

/** Default job titles per role, used when a role is changed (the person keeps their own name). */
const ROLE_TITLES: Record<RoleKey, { ar: string; en: string }> = {
  qm: { ar: "مدير إدارة الجودة", en: "Director of Quality" },
  qe: { ar: "أخصائي جودة", en: "Quality Specialist" },
  pm: { ar: "مدير مشروع", en: "Project Manager" },
  ins: { ar: "مفتش جودة", en: "Quality Inspector" },
  gs: { ar: "مشرف حراسات", en: "Guards Supervisor" },
  guard: { ar: "حارس أمن", en: "Security Guard" },
  gm: { ar: "المدير العام", en: "General Manager" },
};

@Injectable()
export class PeopleService {
  constructor(
    private readonly repo: PeopleRepository,
    private readonly rbac: RbacService,
    private readonly identity: IdentityService,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private async view(p: ProfileRecord, scope: "all" | string[]): Promise<PersonView> {
    const user = await this.users.getUser(p.userId);
    return {
      id: p.userId,
      name: { ar: p.nameAr, en: p.nameEn },
      ini: { ar: initials(p.nameAr), en: initials(p.nameEn) },
      role: p.roleKey,
      title: { ar: p.titleAr, en: p.titleEn },
      email: user?.email ?? "",
      employeeNo: p.employeeNo,
      status: p.status,
      lastActiveAt: p.lastActiveAt ? p.lastActiveAt.toISOString() : null,
      scope,
    };
  }

  private scopeOf(role: RoleKey, projectIds: string[]): "all" | string[] {
    return ALL_PROJECT_ROLES.includes(role) ? "all" : projectIds;
  }

  /** The caller as the app needs to know them: identity, role, scope and effective permissions. */
  async me(who: Access) {
    return readInTenant(async () => {
      const p = (await this.repo.find(who.userId))!;
      const person = await this.view(p, who.allProjects ? "all" : [...who.projectIds]);
      await this.repo.touch(who.userId, this.clock.now());
      return { ...person, permissions: who.template, organizationId: who.organizationId, today: who.today };
    });
  }

  async list(who: Access): Promise<PersonView[]> {
    requireCan(who, "users", "V");
    return readInTenant(async () => {
      const [profiles, assignments] = await Promise.all([this.repo.list(), this.repo.activeAssignments(who.today)]);
      return Promise.all(
        profiles.map((p) =>
          this.view(p, this.scopeOf(p.roleKey, assignments.filter((a) => a.userId === p.userId).map((a) => a.projectId))),
        ),
      );
    });
  }

  async get(id: string, who: Access): Promise<PersonView> {
    requireCan(who, "users", "V");
    return readInTenant(async () => {
      const p = await this.repo.find(id);
      if (!p) throw NotFound("raqib.user_not_found", "User not found.");
      return this.view(p, this.scopeOf(p.roleKey, await this.repo.activeProjectIds(id, who.today)));
    });
  }

  /** Display names for ids (decisions, history, assignees) — read-only, no permission needed beyond a profile. */
  async names(ids: string[]): Promise<Map<string, ProfileRecord>> {
    return readInTenant(async () => new Map((await this.repo.findMany([...new Set(ids)])).map((p) => [p.userId, p])));
  }

  async changeRole(id: string, role: RoleKey, reason: string, who: Access): Promise<PersonView> {
    requireCan(who, "users", "E");
    if (!ROLE_KEYS.includes(role)) throw Conflict("raqib.invalid_role", "Unknown role.");
    return this.uow.transaction(async () => {
      const target = await this.repo.find(id);
      if (!target) throw NotFound("raqib.user_not_found", "User not found.");
      if (id === who.userId) throw Forbidden("raqib.self_role_change", "You cannot change your own role.");
      if (target.roleKey === role) return this.view(target, this.scopeOf(role, await this.repo.activeProjectIds(id, who.today)));
      // Escalation guard: only Quality Management hands out or takes away the two top roles.
      const privileged = (r: RoleKey) => r === "qm" || r === "gm";
      if ((privileged(role) || privileged(target.roleKey)) && who.role !== "qm") {
        throw Forbidden("raqib.role_escalation", "Only Quality Management can grant or remove this role.");
      }
      if (target.roleKey === "qm") {
        const qms = (await this.repo.list()).filter((p) => p.roleKey === "qm" && p.status === "active");
        if (qms.length <= 1) throw Conflict("raqib.last_quality_manager", "There must always be one Quality Management user.");
      }
      const orgId = getContext()?.organizationId;
      await this.rbac.removeRole(id, coreRoleKey(target.roleKey), orgId);
      await this.rbac.assignRole(id, coreRoleKey(role), who.userId, orgId);
      await this.repo.setRole(id, role, ROLE_TITLES[role].ar, ROLE_TITLES[role].en);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.user.role_changed",
        resourceType: "raqib_user",
        resourceId: id,
        before: { role: target.roleKey },
        after: { role },
        metadata: { reason },
      });
      const next = (await this.repo.find(id))!;
      return this.view(next, this.scopeOf(role, await this.repo.activeProjectIds(id, who.today)));
    });
  }

  /** Replace a person's project scope. Removed projects keep their dated history (valid_to). */
  async setScope(id: string, projectIds: string[], reason: string, who: Access): Promise<PersonView> {
    requireCan(who, "users", "E");
    return this.uow.transaction(async () => {
      const target = await this.repo.find(id);
      if (!target) throw NotFound("raqib.user_not_found", "User not found.");
      if (ALL_PROJECT_ROLES.includes(target.roleKey)) {
        throw Conflict("raqib.scope_not_applicable", "This role covers every project; there is no scope to edit.");
      }
      const known = new Set(await this.repo.projectIds());
      for (const pid of projectIds) if (!known.has(pid)) throw NotFound("raqib.project_not_found", "Project not found.");
      const before = await this.repo.openAssignmentProjectIds(id);
      const want = new Set(projectIds);
      for (const pid of projectIds) if (!before.includes(pid)) await this.repo.assign(id, pid, who.today, who.userId, reason);
      for (const pid of before) if (!want.has(pid)) await this.repo.endAssignment(id, pid, who.today, who.userId);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.user.scope_changed",
        resourceType: "raqib_user",
        resourceId: id,
        before: { projects: before },
        after: { projects: [...want] },
        metadata: { reason },
      });
      return this.view(target, await this.repo.activeProjectIds(id, who.today));
    });
  }

  async setStatus(id: string, status: "active" | "disabled", reason: string, who: Access): Promise<PersonView> {
    requireCan(who, "users", "E");
    return this.uow.transaction(async () => {
      const target = await this.repo.find(id);
      if (!target) throw NotFound("raqib.user_not_found", "User not found.");
      if (id === who.userId) throw Forbidden("raqib.self_disable", "You cannot disable your own account.");
      if (target.roleKey === "qm" && who.role !== "qm") throw Forbidden("raqib.role_escalation", "Only Quality Management can change this account.");
      if (target.status === "invited") throw Conflict("raqib.not_activated", "The account has not been activated yet.");
      if (target.status !== status) {
        await this.repo.setStatus(id, status);
        if (status === "disabled") await this.identity.logoutAll(id);
        await this.audit.record({
          actorId: who.userId,
          action: status === "disabled" ? "raqib.user.disabled" : "raqib.user.enabled",
          resourceType: "raqib_user",
          resourceId: id,
          before: { status: target.status },
          after: { status },
          metadata: { reason },
        });
      }
      const next = (await this.repo.find(id))!;
      return this.view(next, this.scopeOf(next.roleKey, await this.repo.activeProjectIds(id, who.today)));
    });
  }
}
