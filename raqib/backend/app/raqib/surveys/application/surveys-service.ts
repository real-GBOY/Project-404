import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { ConfidentialService } from "@raqib/raqib/confidential/application/confidential-service.js";
import type { IdentityMode } from "@raqib/raqib/confidential/infrastructure/conf-repository.js";
import { ScoringRepository } from "@raqib/raqib/scoring/infrastructure/scoring-repository.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { SurveysRepository, type SurveyQuestion, type SurveyRecord, type SurveyStatus } from "../infrastructure/surveys-repository.js";

export interface SurveyView {
  id: string;
  title: L10n;
  intro: L10n;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}
export interface SurveyList {
  items: SurveyView[];
  /** The caller is a person named to manage surveys: they also see drafts and closed surveys and may create and publish. */
  canManage: boolean;
  /** General Manager only: who is named. */
  managers: Array<{ userId: string; name: L10n; at: string }> | null;
  candidates: Array<{ userId: string; name: L10n; role: string }> | null;
}
export interface CreateSurveyInput {
  title: L10n;
  intro: L10n;
  questions: Array<{ type: "rating" | "text"; text: L10n }>;
}

const view = (s: SurveyRecord): SurveyView => ({
  id: s.id,
  title: s.title,
  intro: s.intro,
  questions: s.questions,
  status: s.status,
  createdAt: s.createdAt.toISOString(),
  publishedAt: s.publishedAt?.toISOString() ?? null,
  closedAt: s.closedAt?.toISOString() ?? null,
});

/**
 * Surveys. Their definitions are ordinary data that everyone can read once published; who manages them is a named
 * designation (`survey_manager`), granted by the General Manager and separate from every permission template and from the
 * confidential-area grants. A guard\'s ANSWERS are not stored here at all: they travel through the confidential pipeline as
 * reports of kind "survey" (separate tables, restrictive policy, explicit grants, optional anonymity), so they are exactly
 * as protected as any other confidential report.
 */
@Injectable()
export class SurveysService {
  constructor(
    private readonly repo: SurveysRepository,
    private readonly designations: ScoringRepository,
    private readonly access: AccessService,
    private readonly profiles: AccessRepository,
    private readonly confidential: ConfidentialService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private isManager(who: Access): Promise<boolean> {
    return this.designations.isDesignee(who.userId, "survey_manager");
  }

  async list(who: Access): Promise<SurveyList> {
    return readInTenant(async () => {
      const manager = await this.isManager(who);
      const rows = await this.repo.list(manager ? undefined : ["active"]);
      let managers: SurveyList["managers"] = null;
      let candidates: SurveyList["candidates"] = null;
      if (who.role === "gm") {
        const named = await this.designations.designees("survey_manager");
        managers = await Promise.all(
          named.map(async (d) => {
            const p = await this.access.profileOf(d.userId);
            return { userId: d.userId, name: { ar: p?.nameAr ?? d.userId, en: p?.nameEn ?? d.userId }, at: d.at.toISOString() };
          }),
        );
        candidates = (await this.profiles.allProfiles())
          .filter((p) => p.status === "active" && !named.some((d) => d.userId === p.userId))
          .map((p) => ({ userId: p.userId, name: { ar: p.nameAr, en: p.nameEn }, role: p.roleKey }));
      }
      return { items: rows.map(view), canManage: manager, managers, candidates };
    });
  }

  async create(input: CreateSurveyInput, who: Access): Promise<SurveyView> {
    return this.uow.transaction(async () => {
      if (!(await this.isManager(who))) throw Forbidden("raqib.not_survey_manager", "Only a person named to manage surveys can create one.");
      if (!input.questions.length) throw ValidationError("raqib.no_questions", "A survey needs at least one question.");
      const questions: SurveyQuestion[] = input.questions.map((q, i) => ({ key: `q${i + 1}`, type: q.type, text: q.text }));
      const id = await this.repo.insert({ title: input.title, intro: input.intro, questions, createdBy: who.userId });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.survey.created",
        resourceType: "raqib_survey",
        resourceId: id,
        after: { title: input.title, questions: questions.length },
      });
      return view((await this.repo.find(id))!);
    });
  }

  private async move(id: string, from: SurveyStatus, to: SurveyStatus, who: Access): Promise<SurveyView> {
    return this.uow.transaction(async () => {
      if (!(await this.isManager(who))) throw Forbidden("raqib.not_survey_manager", "Only a person named to manage surveys can do this.");
      const s = await this.repo.find(id, true);
      if (!s) throw NotFound("raqib.survey_not_found", "Survey not found.");
      if (s.status !== from) throw Conflict("raqib.invalid_transition", `A survey that is ${s.status} cannot become ${to}.`);
      await this.repo.setStatus(id, to, this.clock.now());
      await this.audit.record({
        actorId: who.userId,
        action: `raqib.survey.${to === "active" ? "published" : "closed"}`,
        resourceType: "raqib_survey",
        resourceId: id,
      });
      return view((await this.repo.find(id))!);
    });
  }

  publish(id: string, who: Access): Promise<SurveyView> {
    return this.move(id, "draft", "active", who);
  }
  close(id: string, who: Access): Promise<SurveyView> {
    return this.move(id, "active", "closed", who);
  }

  /** A person answers an active survey. The answers become a confidential report; the survey module keeps no copy. */
  async answer(id: string, answers: Record<string, string | number>, identity: IdentityMode, who: Access): Promise<{ ref: string }> {
    const s = await readInTenant(() => this.repo.find(id));
    if (!s) throw NotFound("raqib.survey_not_found", "Survey not found.");
    if (s.status !== "active") throw Conflict("raqib.survey_closed", "This survey is not open for answers.");
    const lines: string[] = [];
    for (const [i, q] of s.questions.entries()) {
      const a = answers[q.key];
      if (q.type === "rating") {
        const n = Number(a);
        if (!Number.isInteger(n) || n < 1 || n > 5)
          throw ValidationError("raqib.answer_required", `Question ${i + 1} needs a rating from 1 to 5.`, { question: q.key });
        lines.push(`${i + 1}. ${q.text.ar}\n   (${q.text.en}): ${n}/5`);
      } else {
        const t = String(a ?? "").trim();
        if (t.length > 2000) throw ValidationError("raqib.answer_too_long", `Answer ${i + 1} is too long.`, { question: q.key });
        lines.push(`${i + 1}. ${q.text.ar}\n   (${q.text.en}): ${t || "—"}`);
      }
    }
    const r = await this.confidential.submit(
      { kind: "survey", subject: `${s.title.en} / ${s.title.ar}`.slice(0, 200), body: lines.join("\n"), place: "", identity, fileIds: [], surveyId: s.id },
      who,
    );
    return { ref: r.ref };
  }

  // ── the General Manager names who manages surveys ──────────────────────

  async designate(userId: string, who: Access): Promise<void> {
    if (who.role !== "gm") throw Forbidden("raqib.gm_only", "Only the General Manager names who manages surveys.");
    await this.uow.transaction(async () => {
      if (!(await this.access.profileOf(userId))) throw NotFound("raqib.user_not_found", "Person not found.");
      if (!(await this.designations.addDesignee(userId, "survey_manager", who.userId)))
        throw Conflict("raqib.already_designated", "This person is already named.");
      await this.audit.record({ actorId: who.userId, action: "raqib.survey.manager_named", resourceType: "raqib_user", resourceId: userId });
    });
  }

  async revoke(userId: string, who: Access): Promise<void> {
    if (who.role !== "gm") throw Forbidden("raqib.gm_only", "Only the General Manager names who manages surveys.");
    await this.uow.transaction(async () => {
      if (!(await this.designations.removeDesignee(userId, "survey_manager"))) throw NotFound("raqib.not_designated", "This person is not named.");
      await this.audit.record({ actorId: who.userId, action: "raqib.survey.manager_removed", resourceType: "raqib_user", resourceId: userId });
    });
  }
}
