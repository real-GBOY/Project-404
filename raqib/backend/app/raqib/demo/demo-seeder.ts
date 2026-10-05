import { Inject, Injectable } from "@nestjs/common";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import type { Clock } from "@core/kernel/clock.js";
import { localDate } from "@raqib/raqib/shared/dates.js";
import { ALL_PROJECT_ROLES } from "@raqib/raqib/shared/modules.js";
import { coreRoleKey } from "@raqib/raqib/shared/roles.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { VisitsService } from "@raqib/raqib/visits/application/visits-service.js";
import { runAsOf } from "@raqib/raqib/shared/business-date.js";
import { addDays } from "@raqib/raqib/shared/dates.js";
import { DEMO_VISITS } from "./demo-visits.js";
import { DEMO_FORMS } from "./demo-forms.js";
import { FormsRepository } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { InspectionsService } from "@raqib/raqib/inspections/application/inspections-service.js";
import { EvidenceService } from "@raqib/raqib/evidence/application/evidence-service.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { DEFAULT_SETTINGS } from "@raqib/raqib/settings/domain/defaults.js";
import { DEMO_NAMED_GUARDS, DEMO_ORG, DEMO_PASSWORD, DEMO_PEOPLE, DEMO_PROJECTS, fillerGuards } from "./demo-data.js";

const log = moduleLogger("raqib-demo-seed");

/**
 * Opt-in demo dataset (`RAQIB_SEED_DEMO=true`, run from `AppSeedService` only). Idempotent: skips
 * entirely if the demo organization already exists. People are inserted with a pre-verified email (the
 * demo must be one click from signed-in) and receive their roles through Core RBAC; everything Raqib
 * specific is written through the Raqib repositories inside the organization's tenant context.
 * The returned ids are keyed by the demo keys so later seeding steps can refer to them.
 */
@Injectable()
export class DemoSeeder {
  constructor(
    private readonly rbac: RbacService,
    private readonly people: PeopleRepository,
    private readonly projects: ProjectsRepository,
    private readonly settings: SettingsRepository,
    private readonly access: AccessService,
    private readonly visits: VisitsService,
    private readonly forms: FormsRepository,
    private readonly inspections: InspectionsService,
    private readonly evidence: EvidenceService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private ids!: { projectIds: Map<string, string>; siteIds: Map<string, string>; areaIds: Map<string, string>; guardIds: Map<string, string> };

  /** Visits are scheduled by the people who would schedule them, on the date they would have, via the real service. */
  private async seedVisits(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const as = async (key: string, agoDays: number, fn: (who: Awaited<ReturnType<AccessService["resolve"]>>) => Promise<unknown>) =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, () =>
        runAsOf(addDays(today, -agoDays), async () => {
          const who = await this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] });
          await fn(who);
        }),
      );
    for (const v of DEMO_VISITS) {
      let visitId = "";
      await as(v.by, v.scheduledAgo, async (who) => {
        const created = await this.visits.create(
          {
            projectId: this.ids.projectIds.get(v.project)!, siteId: this.ids.siteIds.get(v.site)!,
            areaId: v.area !== undefined ? this.ids.areaIds.get(`${v.site}:${v.area}`) : null, areaText: v.areaText,
            inspectorId: v.inspector ? userIds.get(v.inspector)! : null, type: v.type, shift: v.shift,
            date: addDays(today, v.day), time: v.time, guardIds: v.guards.map((g) => this.ids.guardIds.get(g)!), reason: v.reason,
          },
          who,
        );
        visitId = created.id;
      });
      if (v.inspect && v.inspector) {
        const ins = v.inspect;
        const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
        await withContext({ userId: userIds.get(v.inspector)!, organizationId: orgId }, async () => {
          const who = await this.access.resolve({ userId: userIds.get(v.inspector!)!, email: "", organizationId: orgId, permissions: [] });
          let view = await this.inspections.start(visitId, who);
          const itemByKey = (key: string) => view.sections.flatMap((x) => x.items).find((x) => x.key === key)!;
          for (const [key, value] of Object.entries(ins.answers)) {
            view = await this.inspections.saveAnswer(visitId, itemByKey(key).id, { value, ...(ins.notes[key] ? { note: ins.notes[key] } : {}) }, who);
          }
          for (const key of ins.evidenceFor) {
            const ref = await this.files.upload({ content: png, originalName: `IMG_2112.png`, contentType: "image/png", ownerId: who.userId, visibility: "private" });
            await this.evidence.attach({ fileId: ref.id, inspectionId: view.id, itemId: itemByKey(key).id }, who);
          }
        });
      }
      if (v.reschedule) {
        const r = v.reschedule;
        await as(r.by, 2, (who) => this.visits.reschedule(visitId, { date: addDays(today, r.day), time: r.time, reason: r.reason }, who));
      }
      if (v.cancel) {
        const c = v.cancel;
        await as(c.by, 14, (who) => this.visits.cancel(visitId, c.reason, who));
      }
    }
  }

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() =>
      currentExecutor().selectFrom("organizations").select("id").where("slug", "=", DEMO_ORG.slug).executeTakeFirst(),
    );
    if (already) {
      log.info("demo organization already present — skipping");
      return;
    }

    const now = clock.now();
    const today = localDate(now, DEFAULT_SETTINGS.org.tz);
    const startDate = "2026-01-01";
    const orgId = newId("org");
    const userIds = new Map<string, string>();
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const p of DEMO_PEOPLE) {
          const id = newId("usr");
          userIds.set(p.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: p.email,
              email_normalized: p.email.toLowerCase(),
              password_hash: passwordHash,
              display_name: p.name.en,
              status: p.status === "disabled" ? "disabled" : p.status === "invited" ? "pending" : "active",
              email_verified_at: p.status === "invited" ? null : now,
              locale: "ar",
            })
            .execute();
        }
        await ex.insertInto("organizations").values({ id: orgId, name: DEMO_ORG.name, slug: DEMO_ORG.slug, settings: {} }).execute();
        for (const p of DEMO_PEOPLE) {
          await ex
            .insertInto("organization_members")
            .values({ id: newId("mem"), organization_id: orgId, user_id: userIds.get(p.key)!, membership_role: p.owner ? "owner" : "member" })
            .execute();
        }
      }),
    );

    const ownerId = userIds.get("qm")!;
    for (const p of DEMO_PEOPLE) {
      await runAsSystem(() => this.rbac.assignRole(userIds.get(p.key)!, coreRoleKey(p.role), ownerId, orgId));
    }

    await withContext({ userId: ownerId, organizationId: orgId }, async () => {
      await this.uow.transaction(async () => {
        await this.settings.save(DEFAULT_SETTINGS, ownerId);

        for (const f of DEMO_FORMS) {
          const fid = await this.forms.insertForm({ code: f.code, category: f.category, name: f.name, description: f.description, active: f.active, isDefault: f.isDefault, createdBy: ownerId });
          for (const v of f.versions) {
            const vid = await this.forms.insertVersion({ formId: fid, version: v.version, status: v.status === "archived" ? "published" : v.status, sections: v.sections, note: v.note, createdBy: ownerId });
            if (v.status === "archived") await this.forms.archive(vid, new Date());
          }
        }

        for (const p of DEMO_PEOPLE) {
          await this.people.insert({
            userId: userIds.get(p.key)!,
            roleKey: p.role,
            nameAr: p.name.ar,
            nameEn: p.name.en,
            titleAr: p.title.ar,
            titleEn: p.title.en,
            employeeNo: p.employeeNo ?? null,
            status: p.status ?? "active",
          });
        }

        const guardIds = new Map<string, string>();
        const projectIds = new Map<string, string>();
        const siteIds = new Map<string, string>();
        const areaIds = new Map<string, string>();
        for (const pr of DEMO_PROJECTS) {
          const id = await this.projects.create({
            code: pr.code,
            name: pr.name,
            city: pr.city,
            region: pr.region,
            managerUserId: userIds.get(pr.manager) ?? null,
            status: pr.status,
            firstVisitDate: pr.firstVisit ?? null,
          });
          projectIds.set(pr.key, id);
          for (const [si, site] of pr.sites.entries()) {
            const siteId = await this.projects.createSite(id, site.name, si);
            siteIds.set(site.key, siteId);
            for (const [ai, area] of site.areas.entries()) areaIds.set(`${site.key}:${ai}`, await this.projects.createArea(siteId, area, ai));
          }
        }

        for (const p of DEMO_PEOPLE) {
          if (ALL_PROJECT_ROLES.includes(p.role)) continue;
          for (const pk of p.projects) {
            await this.people.assign(userIds.get(p.key)!, projectIds.get(pk)!, startDate, ownerId, "Initial assignment");
          }
        }

        for (const g of [...DEMO_NAMED_GUARDS, ...fillerGuards()]) {
          const gid = await this.projects.createGuard({
            projectId: projectIds.get(g.project)!,
            employeeNo: g.employeeNo,
            nationalId: g.nationalId,
            name: g.name,
            post: g.post,
            shift: g.shift,
            userId: g.user ? userIds.get(g.user)! : null,
          });
          guardIds.set(g.employeeNo, gid);
        }
        this.ids = { projectIds, siteIds, areaIds, guardIds };
      });
    });

    await this.seedVisits(orgId, userIds, today);

    log.info({ orgId, people: DEMO_PEOPLE.length, projects: DEMO_PROJECTS.length, today }, "raqib demo organization seeded");
  }
}
