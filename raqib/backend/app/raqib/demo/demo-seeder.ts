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
import { DEMO_VISITS, type DemoVisit } from "./demo-visits.js";
import { historyVisits } from "./demo-history.js";
import { DEMO_FORMS } from "./demo-forms.js";
import { OnboardingService } from "@raqib/raqib/onboarding/application/onboarding-service.js";
import { ConfidentialService } from "@raqib/raqib/confidential/application/confidential-service.js";
import { TrainingService } from "@raqib/raqib/training/application/training-service.js";
import { ActionsService } from "@raqib/raqib/actions/application/actions-service.js";
import { ObservationsService } from "@raqib/raqib/observations/application/observations-service.js";
import { ReviewService } from "@raqib/raqib/review/application/review-service.js";
import { FormsRepository } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { InspectionsService } from "@raqib/raqib/inspections/application/inspections-service.js";
import { EvidenceService } from "@raqib/raqib/evidence/application/evidence-service.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { sql } from "kysely";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { readRaqibConfig } from "@raqib/config.js";
import { ScoringRepository } from "@raqib/raqib/scoring/infrastructure/scoring-repository.js";
import { SurveysRepository } from "@raqib/raqib/surveys/infrastructure/surveys-repository.js";
import { DEFAULT_SETTINGS } from "@raqib/raqib/settings/domain/defaults.js";
import { DEMO_NAMED_GUARDS, DEMO_ORG, DEMO_PASSWORD, DEMO_PEOPLE, DEMO_PROJECTS, fillerGuards } from "./demo-data.js";

const log = moduleLogger("raqib-demo-seed");

/** Demo placeholder shifts and rest rule (the client has not supplied theirs); only used with RAQIB_DEMO_SAMPLE_VALUES=true. */
const SAMPLE_SETTINGS = {
  ...DEFAULT_SETTINGS,
  schedule: {
    shifts: [
      { key: "morning", nameAr: "صباحية", nameEn: "Morning", start: "06:00", end: "14:00" },
      { key: "evening", nameAr: "مسائية", nameEn: "Evening", start: "14:00", end: "22:00" },
      { key: "night", nameAr: "ليلية", nameEn: "Night", start: "22:00", end: "06:00" },
    ],
    minRestHours: 0,
    maxConsecutiveDays: 6,
  },
};

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
    private readonly review: ReviewService,
    private readonly inspections: InspectionsService,
    private readonly evidence: EvidenceService,
    private readonly observations: ObservationsService,
    private readonly actions: ActionsService,
    private readonly training: TrainingService,
    private readonly confidential: ConfidentialService,
    private readonly surveys: SurveysRepository,
    private readonly scoring: ScoringRepository,
    private readonly onboarding: OnboardingService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private ids!: { projectIds: Map<string, string>; siteIds: Map<string, string>; areaIds: Map<string, string>; guardIds: Map<string, string> };

  /** Complete an inspection as its inspector, submit it, then apply the reviewers' decisions - all through the real services. */
  private async runWorkflow(orgId: string, userIds: Map<string, string>, visitId: string, v: (typeof DEMO_VISITS)[number]): Promise<void> {
    const wf = v.workflow!;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const resolve = (key: string) => this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] });
    const asUser = <T>(key: string, fn: (who: Awaited<ReturnType<typeof resolve>>) => Promise<T>) =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, async () => fn(await resolve(key)));

    await asUser(v.inspector!, async (who) => {
      let view = await this.inspections.start(visitId, who);
      for (const it of view.sections.flatMap((s) => s.items)) {
        const nc = wf.nonCompliant[it.key];
        view = await this.inspections.saveAnswer(visitId, it.id, nc ? { value: "n", note: nc } : { value: "c" }, who);
        if (nc) {
          const ref = await this.files.upload({
            content: png,
            originalName: `IMG_${it.key}.png`,
            contentType: "image/png",
            ownerId: who.userId,
            visibility: "private",
          });
          await this.evidence.attach({ fileId: ref.id, inspectionId: view.id, itemId: it.id }, who);
        }
      }
      const guards = await this.projects.guards();
      for (const g of view.guards) {
        const emp = guards.find((x) => x.id === g.guardId)?.employeeNo ?? "";
        const scores = wf.guardScores?.[emp] ?? [4, 4, 5, 4, 4];
        for (const [idx, c] of view.guardCriteria.entries()) await this.inspections.setGuardScore(visitId, g.guardId, c.id, scores[idx] ?? 4, who);
      }
      await this.inspections.submit(visitId, who);
    });
    for (const step of wf.steps) {
      await asUser(step.by, async (who) => {
        const view = await this.inspections.get(visitId, who);
        const itemIds = (step.itemKeys ?? []).map((k) => view.sections.flatMap((s) => s.items).find((x) => x.key === k)!.id);
        await this.review.decide(visitId, step.action, { reason: step.reason, comment: step.reason, itemIds }, who);
      });
    }
  }

  /** Visits are scheduled by the people who would schedule them, on the date they would have, via the real service. */
  private async seedVisits(orgId: string, userIds: Map<string, string>, today: string, visits: DemoVisit[] = DEMO_VISITS): Promise<void> {
    const as = async (key: string, agoDays: number, fn: (who: Awaited<ReturnType<AccessService["resolve"]>>) => Promise<unknown>) =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, () =>
        runAsOf(addDays(today, -agoDays), async () => {
          const who = await this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] });
          await fn(who);
        }),
      );
    for (const v of visits) {
      let visitId = "";
      await as(v.by, v.scheduledAgo, async (who) => {
        const created = await this.visits.create(
          {
            projectId: this.ids.projectIds.get(v.project)!,
            siteId: this.ids.siteIds.get(v.site)!,
            areaId: v.area !== undefined ? this.ids.areaIds.get(`${v.site}:${v.area}`) : null,
            areaText: v.areaText,
            inspectorId: v.inspector ? userIds.get(v.inspector)! : null,
            type: v.type,
            shift: v.shift,
            date: addDays(today, v.day),
            time: v.time,
            guardIds: v.guards.map((g) => this.ids.guardIds.get(g)!),
            reason: v.reason,
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
            const ref = await this.files.upload({
              content: png,
              originalName: `IMG_2112.png`,
              contentType: "image/png",
              ownerId: who.userId,
              visibility: "private",
            });
            await this.evidence.attach({ fileId: ref.id, inspectionId: view.id, itemId: itemByKey(key).id }, who);
          }
        });
      }
      if (v.workflow) await this.runWorkflow(orgId, userIds, visitId, v);
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

  /**
   * Observations and corrective actions in every state, produced by the real services. Violations already exist
   * (recorded when the demo's approved inspections were approved); here people report two more observations and
   * work corrective actions through assigned, in progress, quality review, returned, closed and overdue.
   */
  private async seedQuality(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const as = async <T>(key: string, agoDays: number, fn: (who: Awaited<ReturnType<AccessService["resolve"]>>) => Promise<T>): Promise<T> =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, () =>
        runAsOf(addDays(today, -agoDays), async () =>
          fn(await this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] })),
        ),
      );
    const violations = await as("qm", 0, (who) => this.observations.list(who));
    const find = (site: string, key: string) => violations.find((o) => o.kind === "violation" && o.site.en === site && o.itemKey === key)!;
    const assign = (obs: string, by: string, to: string, dueDay: number, priority: "low" | "medium" | "high", description: string, ago: number) =>
      as(by, ago, (who) => this.actions.create(obs, { responsibleId: userIds.get(to)!, dueDate: addDays(today, dueDay), priority, description }, who));
    const evidenceFor = (key: string, actionId: string) =>
      as(key, 0, async (who) => {
        const ref = await this.files.upload({
          content: png,
          originalName: "closure.png",
          contentType: "image/png",
          ownerId: who.userId,
          visibility: "private",
        });
        await this.evidence.attachToAction({ fileId: ref.id, actionId }, who);
      });
    const step = (key: string, id: string, s: "start" | "submit" | "return" | "close", text?: string) =>
      as(key, 0, (who) => this.actions.step(id, s, { text }, who));

    // two observations reported directly
    await as("insA", 6, (who) =>
      this.observations.create(
        {
          projectId: this.ids.projectIds.get("p1")!,
          siteId: this.ids.siteIds.get("s1")!,
          text: "Visitor turnstile left unlocked at the pedestrian gate",
          note: "Seen at the shift change.",
          severity: "medium",
        },
        who,
      ),
    );
    await as("insB", 4, (who) =>
      this.observations.create(
        {
          projectId: this.ids.projectIds.get("p2")!,
          siteId: this.ids.siteIds.get("s8")!,
          text: "Floodlight out on the north fence",
          note: "Dark stretch of about 30 m.",
          severity: "high",
        },
        who,
      ),
    );

    // assigned and not yet started (on time)
    await assign(find("Control room", "q5").id, "qm", "pm", 5, "high", "Restore the two offline cameras and confirm recording.", 6);
    // overdue: created long ago, due date passed, never started
    await assign(find("Control room", "q15").id, "qm", "pm", -3, "medium", "Complete the shift handover log for the last two weeks.", 12);
    // in progress
    await assign(find("Main entrance", "q13").id, "qm", "buqami", 7, "low", "Post the evacuation plan on every floor.", 5).then((a) =>
      step("buqami", a.id, "start"),
    );
    // waiting for quality review
    const waiting = await assign(find("Truck gate", "q3").id, "qe", "sultan", 4, "high", "Vehicle search for every truck, logged at the gate.", 9);
    await step("sultan", waiting.id, "start");
    await evidenceFor("sultan", waiting.id);
    await step("sultan", waiting.id, "submit");
    // returned by quality, back with the responsible person
    const returned = await assign(find("Truck gate", "q9").id, "qm", "sultan", 6, "medium", "Scan every checkpoint on each patrol.", 9);
    await step("sultan", returned.id, "start");
    await evidenceFor("sultan", returned.id);
    await step("sultan", returned.id, "submit");
    await step("qe", returned.id, "return", "The attached photo shows the scanner, not the patrol log. Attach the log for the last three patrols.");
    // closed
    const closed = await assign(find("Truck gate", "q8").id, "qe", "sultan", 3, "medium", "Re-issue the patrol schedule and brief the shift.", 10);
    await step("sultan", closed.id, "start");
    await evidenceFor("sultan", closed.id);
    await step("sultan", closed.id, "submit");
    await step("qm", closed.id, "close", "Schedule re-issued and signed by the shift lead.");
  }

  /** Training requests in every state, produced by the real service: supervisor asks, manager decides, quality runs it. */
  private async seedTraining(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const as = async <T>(key: string, agoDays: number, fn: (who: Awaited<ReturnType<AccessService["resolve"]>>) => Promise<T>): Promise<T> =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, () =>
        runAsOf(addDays(today, -agoDays), async () =>
          fn(await this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] })),
        ),
      );
    const guard = (no: string) => this.ids.guardIds.get(no)!;
    // when each request and each of its steps happened (days ago), so the dates shown are not all "today"
    const agos = new Map<string, number[]>();
    const ask = (
      g: string,
      course: string,
      reason: "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment",
      priority: "low" | "medium" | "high",
      related: string,
      notes: string,
      ago: number,
    ) =>
      as("gs", ago, async (who) => {
        const r = await this.training.create({ guardId: guard(g), course, reason, priority, related, notes }, who);
        agos.set(r.id, [ago]);
        return r;
      });
    const step = (
      key: string,
      id: string,
      s: "review" | "approve" | "return" | "reject" | "resubmit" | "schedule" | "complete",
      input: Parameters<TrainingService["step"]>[2],
      ago = 0,
    ) =>
      as(key, ago, async (who) => {
        const r = await this.training.step(id, s, input, who);
        agos.get(id)?.push(ago);
        return r;
      });

    await ask(
      "G-10251",
      "Access control and visitor screening",
      "low_score",
      "high",
      "VIS pending review - Tower A",
      "Scored 55% on visitor screening in the last inspection.",
      2,
    );
    const returned = await ask(
      "G-10288",
      "Control room operations",
      "repeat_issue",
      "medium",
      "Shift handover log",
      "Handover log incomplete twice this month.",
      6,
    );
    await step("pm", returned.id, "return", { text: "Attach the two inspection findings this is based on." }, 5);
    const approved = await ask("G-10234", "Emergency evacuation drills", "refresher", "low", "", "Annual refresher.", 7);
    await step("pm", approved.id, "approve", {}, 6);
    const scheduled = await ask(
      "G-10302",
      "Fire safety awareness",
      "incident",
      "high",
      "OBS-26 extinguishers expired",
      "Missed expired extinguishers during a round.",
      9,
    );
    await step("pm", scheduled.id, "approve", {}, 8);
    await step("qm", scheduled.id, "schedule", { date: addDays(today, 5), provider: "academy" }, 7);
    const done = await ask("G-10234", "Customer-facing conduct", "new_assignment", "medium", "", "New post at the main gate.", 20);
    await step("pm", done.id, "approve", {}, 19);
    await step("qe", done.id, "schedule", { date: addDays(today, -6), provider: "internal" }, 18);
    await step("qe", done.id, "complete", { date: addDays(today, -3), result: "passed", text: "Passed the assessment with 90%." }, 0);
    const rejected = await ask("G-10288", "Advanced surveillance", "refresher", "low", "", "Not needed this quarter.", 12);
    await step("pm", rejected.id, "reject", { text: "Not justified by any finding; revisit next quarter." }, 11);

    // a guard asks for themselves: the first waits for the supervisor, the second was reviewed and now waits for the project manager
    const byGuard = (course: string, reason: "low_score" | "refresher", notes: string, ago: number) =>
      as("guard", ago, async (who) => {
        const r = await this.training.create({ course, reason, priority: "medium", related: "", notes }, who);
        agos.set(r.id, [ago]);
        return r;
      });
    await byGuard("First aid essentials", "refresher", "I would like to renew my first-aid certificate.", 1);
    const reviewed = await byGuard("Radio communication procedure", "low_score", "My last score on radio procedure was low.", 4);
    await step("gs", reviewed.id, "review", { text: "Agreed: the score was low and he asked for it." }, 3);

    // the database stamps rows with the real time, so move each request back to when it "happened" (its history entries are stamped by the pinned date and cannot be edited)
    await withContext({ userId: userIds.get("qm")!, organizationId: orgId }, () =>
      this.uow.transaction(async () => {
        for (const [id, days] of agos) {
          const at = (n: number) => sql<Date>`now() - ${n} * interval '1 day'`;
          await raqibDb()
            .updateTable("raqib_training_requests")
            .set({ created_at: at(days[0]!), updated_at: at(days[days.length - 1]!) })
            .where("id", "=", id)
            .execute();
        }
      }),
    );
  }

  /** One open and one draft survey. The General Manager still names who manages surveys, as in real use. */
  private async seedSurveys(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const createdBy = userIds.get("qm")!;
    await withContext({ userId: createdBy, organizationId: orgId }, () =>
      runAsOf(addDays(today, -3), () =>
        this.uow.transaction(async () => {
          const open = await this.surveys.insert({
            title: { ar: "استبيان رضا الحراس", en: "Guard welfare survey" },
            intro: { ar: "", en: "" },
            createdBy,
            questions: [
              { key: "q1", type: "rating", text: { ar: "ما مدى رضاك عن بيئة العمل؟", en: "How satisfied are you with your working conditions?" } },
              { key: "q2", type: "rating", text: { ar: "هل تتلقى التدريب الكافي؟", en: "Do you receive enough training?" } },
              { key: "q3", type: "text", text: { ar: "ما الذي تقترح تحسينه؟", en: "What would you improve?" } },
            ],
          });
          await this.surveys.setStatus(open, "active", new Date());
          await this.surveys.insert({
            title: { ar: "استبيان المعدات والزي", en: "Equipment and uniform survey" },
            intro: { ar: "", en: "" },
            createdBy,
            questions: [{ key: "q1", type: "text", text: { ar: "هل ينقصك أي معدات؟", en: "Is any equipment missing?" } }],
          });
        }),
      ),
    );
  }

  /**
   * The confidential area: grants issued by the General Manager (through a logged entry), a few reports from the
   * guards in each identity mode, and the quality manager working them. Everything goes through the real service.
   */
  private async seedConfidential(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const as = async <T>(key: string, fn: (who: Awaited<ReturnType<AccessService["resolve"]>>) => Promise<T>): Promise<T> =>
      withContext({ userId: userIds.get(key)!, organizationId: orgId }, () =>
        runAsOf(today, async () => fn(await this.access.resolve({ userId: userIds.get(key)!, email: "", organizationId: orgId, permissions: [] }))),
      );
    const inDays = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 86_400_000).toISOString();
    await as("gm", async (who) => {
      await this.confidential.enter("grant_review", true, null, who);
      await this.confidential.issueGrant(
        { userId: userIds.get("qm")!, level: "respond", scope: "all", reason: "Director of Quality investigates reports", expiresAt: inDays(120) },
        who,
      );
      await this.confidential.issueGrant(
        { userId: userIds.get("legal")!, level: "view", scope: "standard", reason: "Legal counsel review of the October reports", expiresAt: inDays(30) },
        who,
      );
      await this.confidential.issueGrant(
        { userId: userIds.get("bandar")!, level: "view", scope: "standard", reason: "Temporary site review", expiresAt: inDays(14) },
        who,
      );
      const grants = await this.confidential.grants(who);
      const temp = grants.find((g) => g.user.id === userIds.get("bandar"))!;
      await this.confidential.revokeGrant(temp.id, "Site review finished early.", who);
      await this.confidential.exit(null, who);
    });
    const submit = (key: string, input: Parameters<ConfidentialService["submit"]>[0]) => as(key, (who) => this.confidential.submit(input, who));
    const a = await submit("guard", {
      kind: "safety",
      subject: "Broken lock on the parking attendants room",
      body: "The lock on the attendants room at level P1 has been broken for two weeks and equipment is exposed.",
      place: "Parking P1",
      identity: "named",
      fileIds: [],
    });
    const b = await submit("turki", {
      kind: "misconduct",
      subject: "A supervisor asked for payment to arrange shifts",
      body: "A site supervisor asked me for money in exchange for better shifts. This happened twice this month in front of the main gate.",
      place: "Main gate",
      identity: "confidential",
      fileIds: [],
    });
    await submit("guard", {
      kind: "violation",
      subject: "Visitors admitted without ID at night",
      body: "On two nights this week visitors were allowed in through the vehicle gate without any ID check.",
      place: "Vehicle gate",
      identity: "anonymous",
      fileIds: [],
    });
    await as("qm", async (who) => {
      await this.confidential.enter("investigation", true, null, who);
      const list = await this.confidential.list(null, who);
      const first = list.find((r) => r.ref === a.ref)!;
      await this.confidential.respond(first.id, "Thank you. The lock has been replaced and the room is secured.", "closed", null, who);
      const second = list.find((r) => r.ref === b.ref)!;
      await this.confidential.respond(second.id, "We have opened a formal inquiry. You will be told the outcome.", "under_review", null, who);
      await this.confidential.exit(null, who);
    });
  }

  /** Two people waiting for an account and one already turned down, through the real public path and the reviewer's decision. */
  private async seedRequests(orgId: string, userIds: Map<string, string>, today: string): Promise<void> {
    const form = (name: string, email: string, nid: string, role: "qe" | "pm" | "ins" | "gs" | "guard", projects: string, just: string) => ({
      name,
      email,
      phone: "0550000000",
      nationalId: nid,
      employeeNo: "",
      department: "Operations",
      role,
      projects,
      justification: just,
      signature: name,
      agree: true,
    });
    const a = await this.onboarding.submitPublic(
      DEMO_ORG.slug,
      form("Hamad Al-Dossary", "h.aldossary@example.com", "1011223344", "ins", "Al-Waha Business Park", "Joining the Riyadh inspection team next month."),
    );
    await this.onboarding.submitPublic(
      DEMO_ORG.slug,
      form(
        "Layan Al-Harbi",
        "l.alharbi@example.com",
        "1022334455",
        "gs",
        "Eastern Specialist Hospital",
        "Covering the guards supervisor post at the hospital.",
      ),
    );
    const c = await this.onboarding.submitPublic(
      DEMO_ORG.slug,
      form("Nasser Al-Qahtani", "n.alqahtani2@example.com", "1033445566", "pm", "Jeddah Logistics Hub", "Requesting manager access to the Jeddah project."),
    );
    void a;
    await withContext({ userId: userIds.get("qm")!, organizationId: orgId }, () =>
      runAsOf(today, async () => {
        const who = await this.access.resolve({ userId: userIds.get("qm")!, email: "", organizationId: orgId, permissions: [] });
        const list = await this.onboarding.list(who);
        const target = list.find((r) => r.ref === c.ref)!;
        await this.onboarding.reject(target.id, "That project already has a manager.", who);
      }),
    );
  }

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() => currentExecutor().selectFrom("organizations").select("id").where("slug", "=", DEMO_ORG.slug).executeTakeFirst());
    if (already) {
      log.info("demo organization already present — skipping");
      return;
    }

    const now = clock.now();
    const today = localDate(now, DEFAULT_SETTINGS.org.tz);
    // assignments must reach back past the oldest generated inspection, or the inspector would not have been eligible for it
    const startDate = [addDays(today, -(readRaqibConfig().demoHistoryDays + 7)), "2026-01-01"].sort()[0]!;
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
        const sample = readRaqibConfig().demoSampleValues;
        // the demo schedules visits ahead of time and lets them be started straight away; a real organization starts on the day
        const base = sample ? SAMPLE_SETTINGS : DEFAULT_SETTINGS;
        await this.settings.save({ ...base, insp: { ...base.insp, allowEarlyStart: true } }, ownerId);
        if (sample) {
          // PLACEHOLDER deduction values for the demo, not the client's: 100 minus these per non-compliant item
          await this.scoring.insert({
            base: 100,
            bySeverity: { high: 10, medium: 5, low: 2 },
            byItem: {},
            reason: "Demo placeholder values (not the client's approved table)",
            createdBy: ownerId,
          });
          // the quality manager is named as scoring manager, so Settings → Scoring rules is editable in the demo
          await this.scoring.addDesignee(userIds.get("qm")!, "scoring_admin", ownerId);
        }

        for (const f of DEMO_FORMS) {
          const fid = await this.forms.insertForm({
            code: f.code,
            category: f.category,
            name: f.name,
            description: f.description,
            active: f.active,
            isDefault: f.isDefault,
            createdBy: ownerId,
          });
          for (const v of f.versions) {
            const vid = await this.forms.insertVersion({
              formId: fid,
              version: v.version,
              status: v.status === "archived" ? "published" : v.status,
              sections: v.sections,
              note: v.note,
              createdBy: ownerId,
            });
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
            contractStart: addDays(today, -540),
            contractEnd: addDays(today, pr.contractEndInDays),
            employeesAssigned: pr.guards || 12,
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
    await this.seedQuality(orgId, userIds, today);
    await this.seedTraining(orgId, userIds, today);
    await this.seedSurveys(orgId, userIds, today);
    await this.seedConfidential(orgId, userIds, today);
    await this.seedRequests(orgId, userIds, today);
    // a year of ordinary approved inspections, so the overview and analytics have something to show (RAQIB_DEMO_HISTORY_DAYS)
    await this.seedVisits(orgId, userIds, today, historyVisits(readRaqibConfig().demoHistoryDays));

    log.info({ orgId, people: DEMO_PEOPLE.length, projects: DEMO_PROJECTS.length, today }, "raqib demo organization seeded");
  }
}
