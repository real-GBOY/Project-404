import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { can, inScope, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { isUniqueViolation } from "@raqib/raqib/shared/pg-errors.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { maskNationalId, type GuardView, type ProjectView, type SiteView } from "../domain/project.js";
import { ProjectsRepository, type GuardInput, type GuardRecord, type ProjectInput, type ProjectRecord } from "../infrastructure/projects-repository.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    private readonly people: PeopleRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private async assemble(projects: ProjectRecord[]): Promise<ProjectView[]> {
    const ids = projects.map((p) => p.id);
    const [sites, counts, managers] = await Promise.all([
      this.repo.sites(ids),
      this.repo.guardCounts(),
      this.people.findMany(projects.map((p) => p.managerUserId).filter((v): v is string => !!v)),
    ]);
    const areas = await this.repo.areas(sites.map((s) => s.id));
    const mgr = new Map(managers.map((m) => [m.userId, m]));
    return projects.map((p) => {
      const m = p.managerUserId ? mgr.get(p.managerUserId) : undefined;
      const mySites: SiteView[] = sites
        .filter((s) => s.projectId === p.id)
        .map((s) => ({ id: s.id, name: s.name, areas: areas.filter((a) => a.siteId === s.id).map((a) => ({ id: a.id, name: a.name })) }));
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        city: p.city,
        region: p.region,
        manager: m ? { id: m.userId, name: { ar: m.nameAr, en: m.nameEn } } : null,
        status: p.status,
        firstVisitDate: p.firstVisitDate,
        contractStart: p.contractStart,
        contractEnd: p.contractEnd,
        employeesAssigned: p.employeesAssigned,
        guardCount: counts.get(p.id) ?? 0,
        sites: mySites,
      };
    });
  }

  async list(who: Access): Promise<ProjectView[]> {
    requireCan(who, "projects", "V");
    return readInTenant(async () => this.assemble((await this.repo.list()).filter((p) => inScope(who, p.id))));
  }

  async get(id: string, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "V");
    return readInTenant(async () => {
      const p = await this.repo.find(id);
      // Out-of-scope and missing look different on purpose only to the audit log, never to the caller's data.
      if (!p) throw NotFound("raqib.project_not_found", "Project not found.");
      requireProject(who, p.id);
      return (await this.assemble([p]))[0]!;
    });
  }

  private requireContractOrder(start: string | null | undefined, end: string | null | undefined): void {
    if (start && end && end < start) throw ValidationError("raqib.contract_dates", "The contract cannot end before it starts.");
  }

  async create(input: ProjectInput, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "A");
    if (!who.allProjects) throw Forbidden("raqib.out_of_scope", "Only roles covering every project can create projects.");
    this.requireContractOrder(input.contractStart, input.contractEnd);
    try {
      return await this.uow.transaction(async () => {
        const id = await this.repo.create(input);
        await this.audit.record({ actorId: who.userId, action: "raqib.project.created", resourceType: "raqib_project", resourceId: id, after: input });
        return (await this.assemble([(await this.repo.find(id))!]))[0]!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "raqib_projects_code_uq")) throw Conflict("raqib.project_code_taken", "A project with this code already exists.");
      throw err;
    }
  }

  async update(id: string, patch: Partial<ProjectInput>, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const before = await this.repo.find(id);
      if (!before) throw NotFound("raqib.project_not_found", "Project not found.");
      requireProject(who, id);
      this.requireContractOrder(
        patch.contractStart === undefined ? before.contractStart : patch.contractStart,
        patch.contractEnd === undefined ? before.contractEnd : patch.contractEnd,
      );
      await this.repo.update(id, patch);
      await this.audit.record({ actorId: who.userId, action: "raqib.project.updated", resourceType: "raqib_project", resourceId: id, before, after: patch });
      return (await this.assemble([(await this.repo.find(id))!]))[0]!;
    });
  }

  async addSite(projectId: string, name: L10n, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      if (!(await this.repo.find(projectId))) throw NotFound("raqib.project_not_found", "Project not found.");
      requireProject(who, projectId);
      const id = await this.repo.createSite(projectId, name);
      await this.audit.record({ actorId: who.userId, action: "raqib.site.created", resourceType: "raqib_site", resourceId: id, after: { projectId, name } });
      return (await this.assemble([(await this.repo.find(projectId))!]))[0]!;
    });
  }

  async renameSite(siteId: string, name: L10n, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const site = await this.repo.findSite(siteId);
      if (!site) throw NotFound("raqib.site_not_found", "Site not found.");
      requireProject(who, site.projectId);
      await this.repo.updateSite(siteId, name);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.site.updated",
        resourceType: "raqib_site",
        resourceId: siteId,
        before: site.name,
        after: name,
      });
      return (await this.assemble([(await this.repo.find(site.projectId))!]))[0]!;
    });
  }

  async archiveSite(siteId: string, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const site = await this.repo.findSite(siteId);
      if (!site) throw NotFound("raqib.site_not_found", "Site not found.");
      requireProject(who, site.projectId);
      await this.repo.archiveSite(siteId);
      await this.audit.record({ actorId: who.userId, action: "raqib.site.archived", resourceType: "raqib_site", resourceId: siteId, before: site });
      return (await this.assemble([(await this.repo.find(site.projectId))!]))[0]!;
    });
  }

  async addArea(siteId: string, name: L10n, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const site = await this.repo.findSite(siteId);
      if (!site) throw NotFound("raqib.site_not_found", "Site not found.");
      requireProject(who, site.projectId);
      const id = await this.repo.createArea(siteId, name);
      await this.audit.record({ actorId: who.userId, action: "raqib.area.created", resourceType: "raqib_area", resourceId: id, after: { siteId, name } });
      return (await this.assemble([(await this.repo.find(site.projectId))!]))[0]!;
    });
  }

  async archiveArea(areaId: string, who: Access): Promise<ProjectView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const area = await this.repo.findArea(areaId);
      if (!area) throw NotFound("raqib.area_not_found", "Area not found.");
      const site = (await this.repo.findSite(area.siteId))!;
      requireProject(who, site.projectId);
      await this.repo.archiveArea(areaId);
      await this.audit.record({ actorId: who.userId, action: "raqib.area.archived", resourceType: "raqib_area", resourceId: areaId, before: area });
      return (await this.assemble([(await this.repo.find(site.projectId))!]))[0]!;
    });
  }

  // ── guards ──────────────────────────────────────────────────────────────

  private guardView(g: GuardRecord): GuardView {
    return {
      id: g.id,
      projectId: g.projectId,
      employeeNo: g.employeeNo,
      nationalId: maskNationalId(g.nationalId),
      name: g.name,
      post: g.post,
      shift: g.shift,
      status: g.status,
      userId: g.userId,
    };
  }

  private requireGuardAccess(who: Access): void {
    if (!can(who, "guardEval", "V") && !can(who, "training", "V")) {
      throw Forbidden("raqib.forbidden", "Your role is not permitted to view guards.");
    }
  }

  /** Everything a guard record may carry, for the audit trail. The national ID is never written there. */
  private guardAudit(g: Partial<GuardRecord>) {
    const { nationalId: _hidden, ...rest } = g;
    return rest;
  }

  private async requireGuardAccount(userId: string | null | undefined): Promise<void> {
    if (!userId) return;
    const profile = await this.people.find(userId);
    if (!profile || profile.roleKey !== "guard")
      throw ValidationError("raqib.invalid_account", "The linked account must belong to a person with the guard role.");
  }

  private async guardWrite<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err, "raqib_guards_employee_uq")) throw Conflict("raqib.employee_taken", "A guard with this employee number already exists.");
      if (isUniqueViolation(err, "raqib_guards_user_uq")) throw Conflict("raqib.account_already_linked", "That account is already linked to another guard.");
      throw err;
    }
  }

  async createGuard(input: GuardInput, who: Access): Promise<GuardView> {
    requireCan(who, "projects", "E");
    return this.guardWrite(() =>
      this.uow.transaction(async () => {
        if (!(await this.repo.find(input.projectId))) throw NotFound("raqib.project_not_found", "Project not found.");
        requireProject(who, input.projectId);
        await this.requireGuardAccount(input.userId);
        const id = await this.repo.createGuard(input);
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.guard.created",
          resourceType: "raqib_guard",
          resourceId: id,
          after: this.guardAudit({ ...input, id } as Partial<GuardRecord>),
        });
        return this.guardView((await this.repo.findGuard(id))!);
      }),
    );
  }

  async updateGuard(id: string, patch: Partial<Omit<GuardInput, "employeeNo">>, who: Access): Promise<GuardView> {
    requireCan(who, "projects", "E");
    return this.guardWrite(() =>
      this.uow.transaction(async () => {
        const before = await this.repo.findGuard(id);
        if (!before) throw NotFound("raqib.guard_not_found", "Guard not found.");
        requireProject(who, before.projectId);
        if (patch.projectId && patch.projectId !== before.projectId) {
          if (!(await this.repo.find(patch.projectId))) throw NotFound("raqib.project_not_found", "Project not found.");
          requireProject(who, patch.projectId);
        }
        if (patch.userId !== undefined) await this.requireGuardAccount(patch.userId);
        await this.repo.updateGuard(id, patch);
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.guard.updated",
          resourceType: "raqib_guard",
          resourceId: id,
          before: this.guardAudit(before),
          after: this.guardAudit({ ...patch, nationalId: undefined } as Partial<GuardRecord>),
          metadata: patch.nationalId ? { nationalIdChanged: true } : {},
        });
        return this.guardView((await this.repo.findGuard(id))!);
      }),
    );
  }

  /** Take a guard off (or back onto) the roster. Their history stays; they just cannot be put on new visits. */
  async setGuardStatus(id: string, status: "active" | "inactive", who: Access): Promise<GuardView> {
    requireCan(who, "projects", "E");
    return this.uow.transaction(async () => {
      const g = await this.repo.findGuard(id);
      if (!g) throw NotFound("raqib.guard_not_found", "Guard not found.");
      requireProject(who, g.projectId);
      await this.repo.setGuardStatus(id, status);
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.guard.status_changed",
        resourceType: "raqib_guard",
        resourceId: id,
        before: { status: g.status },
        after: { status },
      });
      return this.guardView((await this.repo.findGuard(id))!);
    });
  }

  async guards(who: Access): Promise<GuardView[]> {
    this.requireGuardAccess(who);
    return readInTenant(async () => {
      const all = await this.repo.guards(who.allProjects ? undefined : [...who.projectIds]);
      return all.map((g) => this.guardView(g));
    });
  }

  /**
   * Guards whose full national ID equals `nationalId`, within the caller's own projects. An exact 10-digit match only (there is
   * no partial or prefix search on national IDs), and the result is masked like every other guard view.
   */
  async guardsByNationalId(nationalId: string, who: Access): Promise<GuardView[]> {
    this.requireGuardAccess(who);
    return readInTenant(async () => {
      const all = await this.repo.guards(who.allProjects ? undefined : [...who.projectIds]);
      return all.filter((g) => g.nationalId === nationalId).map((g) => this.guardView(g));
    });
  }

  async guard(id: string, who: Access): Promise<GuardView> {
    this.requireGuardAccess(who);
    return readInTenant(async () => {
      const g = await this.repo.findGuard(id);
      if (!g) throw NotFound("raqib.guard_not_found", "Guard not found.");
      requireProject(who, g.projectId);
      return this.guardView(g);
    });
  }
}
