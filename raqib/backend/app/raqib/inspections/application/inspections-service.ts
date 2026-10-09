import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { defineEvent } from "@core/contracts/domain-event.js";
import { actorOf, can, canSeeScore, inScope, requireCan, type Access } from "@raqib/raqib/access/access.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { EvidenceRepository, type EvidenceRecord } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { FormsRepository, type FormRecord } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { next as visitNext } from "@raqib/raqib/visits/domain/visit-state.js";
import { VisitsRepository, type VisitRecord } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { DEDUCTION_POLICY, DEFAULT_POLICY, guardScore, policyFor, visitScore, type Answer, type DeductionConfig, type ScoreResult } from "../domain/scoring.js";
import { ScoringRepository } from "@raqib/raqib/scoring/infrastructure/scoring-repository.js";
import { submissionIssues, type Issue, type ItemFacts } from "../domain/submission.js";
import { InspectionsRepository, type AnswerRecord, type InspectionRecord, type ItemRecord, type NewItem } from "../infrastructure/inspections-repository.js";

export interface EvidenceView {
  id: string;
  name: string;
  kind: "photo" | "video" | "doc";
  mime: string;
  sizeBytes: number;
  at: string;
  by: string | null;
}
export interface ItemView {
  id: string;
  key: string;
  num: string;
  text: L10n;
  weight: number;
  required: boolean;
  na: boolean;
  evidenceOnNc: boolean;
  answer: Answer;
  note: string;
  severity: "low" | "medium" | "high" | null;
  evidence: EvidenceView[];
  /** A reviewer sent this item back and it has not been edited since. */
  flagged: boolean;
  /** Edited since it was sent back. */
  fixed: boolean;
  /** Not editable in the current state (e.g. an item the reviewer did not flag on a returned inspection). */
  locked: boolean;
}
export interface GuardEvalView {
  guardId: string;
  scores: Record<string, number>;
  note: string;
  evidence: EvidenceView[];
  pct: number | null;
  done: boolean;
  answered: number;
}
export interface VisitFormView {
  formId: string;
  code: string;
  name: L10n;
  position: number;
  /** The inspection issue number once the form has been started. */
  issueNo: string | null;
  inspectionId: string | null;
  started: boolean;
  answered: number;
  total: number;
  /** Items still blocking submission (0 when complete). */
  blocking: number;
  submitted: boolean;
}
export interface InspectionView {
  id: string;
  visitId: string;
  ref: string;
  /** The unique number of this form inspection (a visit with several forms has one per form). */
  issueNo: string;
  formId: string;
  /** Index of this form among the visit's required forms (0 = the lead form). */
  position: number;
  status: string;
  round: number;
  form: { versionId: string; code: string; version: string; name: L10n };
  sections: Array<{ key: string; title: L10n; items: ItemView[] }>;
  guardCriteria: Array<{ id: string; key: string; text: L10n }>;
  guards: GuardEvalView[];
  /** Roles that only inspect get counts but never the percentage or the deductions. */
  score: ScoreResult & { evidence: number; visible: boolean };
  /** The rules this inspection is scored under (a deduction configuration is pinned at start). */
  scoring: { policy: string; version: number | null };
  issues: Issue[];
  /** Items sent back in earlier submission rounds (for the resubmission comparison). */
  previous: Array<{ round: number; itemIds: string[] }>;
  editable: boolean;
  submittedAt: string | null;
  startedAt: string;
}

const inspectionSubmitted = (p: { visitId: string; actorId: string; resubmission: boolean }) => defineEvent("raqib.inspection_submitted", 1, p);

@Injectable()
export class InspectionsService {
  constructor(
    private readonly repo: InspectionsRepository,
    private readonly visits: VisitsRepository,
    private readonly forms: FormsRepository,
    private readonly evidence: EvidenceRepository,
    private readonly projects: ProjectsRepository,
    private readonly people: PeopleRepository,
    private readonly settings: SettingsService,
    private readonly scoring: ScoringRepository,
    private readonly counters: Counters,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ── access rules ────────────────────────────────────────────────────────

  private isInspector(who: Access, v: VisitRecord): boolean {
    return v.inspectorId === who.userId && can(who, "inspections", "S");
  }

  /** The inspector who owns the visit, or someone who reviews/approves in the visit's project. */
  canRead(who: Access, v: VisitRecord): boolean {
    if (this.isInspector(who, v)) return true;
    return inScope(who, v.projectId) && (can(who, "inspections", "R") || can(who, "inspections", "P"));
  }

  private async requireVisit(visitId: string, lock = false): Promise<VisitRecord> {
    const v = await this.visits.find(visitId, lock);
    if (!v) throw NotFound("raqib.visit_not_found", "Visit not found.");
    return v;
  }

  // ── view ────────────────────────────────────────────────────────────────

  // ── scoring ─────────────────────────────────────────────────────────────

  /** The configuration an inspection was pinned to when it started (null for the earlier weighted policy). */
  private async configOf(i: InspectionRecord): Promise<DeductionConfig | null> {
    return i.scoringConfigId ? this.scoring.byId(i.scoringConfigId) : null;
  }

  private async versionOf(i: InspectionRecord): Promise<number | null> {
    return (await this.configOf(i))?.version ?? null;
  }

  private async scoreOf(i: InspectionRecord, items: ItemRecord[], answers: Map<string, AnswerRecord>): Promise<ScoreResult> {
    const policy = policyFor(i.scoringPolicy, await this.configOf(i));
    return policy.score(
      items.map((it) => ({
        weight: it.weight,
        id: it.id,
        key: it.key,
        answer: answers.get(it.id)?.value ?? null,
        severity: answers.get(it.id)?.severity ?? null,
      })),
    );
  }

  private async assemble(i: InspectionRecord, v: VisitRecord, who: Access): Promise<InspectionView> {
    const [items, answers, flags, ev, scores, notes] = await Promise.all([
      this.repo.items(i.id),
      this.repo.answers(i.id),
      this.repo.flags(i.id),
      this.evidence.forInspection(i.id),
      this.repo.guardScores(i.id),
      this.repo.guardNotes(i.id),
    ]);
    const version = await this.forms.version(i.formVersionId);
    const form = version ? await this.forms.form(version.formId) : null;
    const s = await this.settings.current();
    const uploaders = await this.people.findMany([...new Set(ev.map((e) => e.uploadedBy).filter((x): x is string => !!x))]);
    const byName = new Map(uploaders.map((p) => [p.userId, p.nameEn]));
    const evView = (e: EvidenceRecord): EvidenceView => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      mime: e.mime,
      sizeBytes: e.sizeBytes,
      at: e.uploadedAt.toISOString(),
      by: e.uploadedBy ? (byName.get(e.uploadedBy) ?? null) : null,
    });
    const returned = v.status === "returned";
    const flagged = new Set(flags.filter((f) => f.round === v.round).map((f) => f.itemId));
    const editableState = v.status === "in_progress" || returned;
    const mine = this.isInspector(who, v);

    const siteItems = items.filter((x) => x.kind === "site");
    const sections = new Map<number, { key: string; title: L10n; items: ItemView[] }>();
    const facts: ItemFacts[] = [];
    siteItems.forEach((it) => {
      const a = answers.get(it.id);
      const itemEvidence = ev.filter((e) => e.itemId === it.id && e.context === "answer");
      const isFlagged = flagged.has(it.id);
      const fixed = isFlagged && !!a && a.editedRound > v.round;
      const num = `${it.sectionPos + 1}.${it.position + 1}`;
      const view: ItemView = {
        id: it.id,
        key: it.key,
        num,
        text: it.text,
        weight: it.weight,
        required: it.required,
        na: it.na,
        evidenceOnNc: it.evidenceOnNc,
        answer: a?.value ?? null,
        note: a?.note ?? "",
        severity: a?.severity ?? null,
        evidence: itemEvidence.map(evView),
        flagged: isFlagged && !fixed,
        fixed,
        locked: !editableState || (returned && !isFlagged),
      };
      const sec = sections.get(it.sectionPos) ?? { key: it.sectionKey, title: it.sectionTitle, items: [] };
      sec.items.push(view);
      sections.set(it.sectionPos, sec);
      facts.push({
        num,
        step: it.sectionPos,
        required: it.required,
        evidenceOnNc: it.evidenceOnNc,
        answer: view.answer,
        note: view.note,
        storedEvidence: itemEvidence.length,
        pendingEvidence: 0,
        flagged: isFlagged,
        touchedSinceFlag: fixed,
      });
    });

    const criteria = items.filter((x) => x.kind === "guard");
    const guardIds = (await this.visits.guardIds([v.id])).get(v.id) ?? [];
    const guards: GuardEvalView[] = guardIds.map((gid) => {
      const mineScores = scores.filter((x) => x.guardId === gid);
      const byItem = Object.fromEntries(mineScores.map((x) => [x.itemId, x.score]));
      const g = guardScore(
        criteria.map((c) => byItem[c.id] ?? null),
        criteria.length,
      );
      return {
        guardId: gid,
        scores: byItem,
        note: notes.get(gid) ?? "",
        evidence: ev.filter((e) => e.guardId === gid && e.context === "guard_eval").map(evView),
        pct: g.pct,
        done: g.done,
        answered: g.n,
      };
    });
    const guardNames = new Map((await this.projects.guards([v.projectId])).map((g) => [g.id, g.name.en]));
    const issues = submissionIssues(
      facts,
      guards.map((g) => ({ name: guardNames.get(g.guardId) ?? g.guardId, done: g.done || criteria.length === 0 })),
      { ncNote: s.insp.ncNote, ncEvidence: s.insp.ncEvidence },
    );
    const result = await this.scoreOf(i, siteItems, answers);
    const visible = canSeeScore(who);

    return {
      id: i.id,
      visitId: v.id,
      ref: v.ref,
      issueNo: i.issueNo,
      formId: i.formId,
      position: Math.max(
        0,
        (await this.requiredForms(v.id)).findIndex((f) => f.id === i.formId),
      ),
      status: v.status,
      round: v.round,
      form: { versionId: i.formVersionId, code: form?.code ?? "", version: version?.version ?? "", name: form?.name ?? { ar: "", en: "" } },
      sections: [...sections.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x),
      guardCriteria: criteria.map((c) => ({ id: c.id, key: c.key, text: c.text })),
      guards,
      score: {
        // an inspector keeps the answer counts (progress) but never the percentage or the deductions
        ...(visible ? result : { ...result, deductions: undefined, unpriced: undefined }),
        pct: !visible ? null : i.submittedAt && returned === false ? (i.scorePct ?? result.pct) : result.pct,
        evidence: ev.filter((e) => e.context === "answer").length,
        visible,
      },
      scoring: { policy: i.scoringPolicy, version: visible ? await this.versionOf(i) : null },
      previous: [...new Set(flags.filter((f) => f.round < v.round).map((f) => f.round))]
        .sort()
        .map((round) => ({ round, itemIds: flags.filter((f) => f.round === round).map((f) => f.itemId) })),
      issues,
      editable: mine && editableState,
      submittedAt: i.submittedAt?.toISOString() ?? null,
      startedAt: i.startedAt.toISOString(),
    };
  }

  // ── the forms of a visit ────────────────────────────────────────────────

  /** The forms a visit requires, in order. A visit scheduled without any uses the organization default site form. */
  async requiredForms(visitId: string): Promise<FormRecord[]> {
    const ids = (await this.visits.formIds([visitId])).get(visitId) ?? [];
    if (ids.length) {
      const out: FormRecord[] = [];
      for (const id of ids) {
        const f = await this.forms.form(id);
        if (f) out.push(f);
      }
      return out;
    }
    const d = await this.forms.defaultForm("site");
    return d ? [d] : [];
  }

  /** The inspection of one required form (the first one by default); `formId` that the visit does not require is a 404. */
  private async inspectionFor(visitId: string, formId: string | undefined, lock = false): Promise<InspectionRecord | null> {
    const required = await this.requiredForms(visitId);
    const target = formId ?? required[0]?.id;
    if (formId && !required.some((f) => f.id === formId)) throw NotFound("raqib.form_not_required", "This visit does not require that form.");
    return target ? this.repo.findByVisitForm(visitId, target, lock) : this.repo.findByVisit(visitId, lock);
  }

  async get(visitId: string, who: Access, formId?: string): Promise<InspectionView> {
    return readInTenant(async () => {
      const v = await this.requireVisit(visitId);
      if (!this.canRead(who, v)) throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      const i = await this.inspectionFor(visitId, formId);
      if (!i) throw NotFound("raqib.inspection_not_started", "This form has not been started.");
      return this.assemble(i, v, who);
    });
  }

  /** Every started inspection of the visit, in the order its forms are required (used by review, observations and the report). */
  async getAll(visitId: string, who: Access): Promise<InspectionView[]> {
    return readInTenant(async () => {
      const v = await this.requireVisit(visitId);
      if (!this.canRead(who, v)) throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      const out: InspectionView[] = [];
      for (const f of await this.requiredForms(visitId)) {
        const i = await this.repo.findByVisitForm(visitId, f.id);
        if (i) out.push(await this.assemble(i, v, who));
      }
      return out;
    });
  }

  /** The visit's forms with how far each has got (the inspector's checklist of forms, and the reviewer's overview). */
  async formsOf(visitId: string, who: Access): Promise<VisitFormView[]> {
    return readInTenant(async () => {
      const v = await this.requireVisit(visitId);
      if (!this.canRead(who, v) && !(inScope(who, v.projectId) && can(who, "visits", "V"))) {
        throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      }
      const out: VisitFormView[] = [];
      const required = await this.requiredForms(visitId);
      for (const [position, f] of required.entries()) {
        const i = await this.repo.findByVisitForm(visitId, f.id);
        const base = { formId: f.id, code: f.code, name: f.name, position, issueNo: i?.issueNo ?? null, inspectionId: i?.id ?? null };
        if (!i || !this.canRead(who, v)) {
          out.push({ ...base, started: !!i, answered: 0, total: 0, blocking: 0, submitted: !!i?.submittedAt });
          continue;
        }
        const view = await this.assemble(i, v, who);
        out.push({ ...base, started: true, answered: view.score.answered, total: view.score.total, blocking: view.issues.length, submitted: !!i.submittedAt });
      }
      return out;
    });
  }

  // ── start ───────────────────────────────────────────────────────────────

  /**
   * Start (or continue) the inspection of one of the visit's forms (the first by default). Starting snapshots the
   * published form - and, on the first form, the guard form - into the inspection, so later edits to a form can never
   * change what this inspection means. Each inspection gets its own issue number.
   */
  async start(visitId: string, who: Access, formId?: string): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const v = await this.requireVisit(visitId, true);
      if (v.inspectorId !== who.userId) throw Forbidden("raqib.out_of_scope", "This visit is not assigned to you.");
      const required = await this.requiredForms(visitId);
      if (!required.length) throw Conflict("raqib.no_form", "No inspection form is published. Ask Quality Management to publish one.");
      const form = formId ? required.find((f) => f.id === formId) : required[0];
      if (!form) throw NotFound("raqib.form_not_required", "This visit does not require that form.");
      let i = await this.repo.findByVisitForm(visitId, form.id, true);
      if (!i) {
        // the first form moves the visit into progress; the others may be started while it is under way
        let to = v.status;
        if (v.status === "scheduled" || v.status === "assigned") {
          const moved = visitNext(v.status, "start", true);
          if (!moved) throw Conflict("raqib.cannot_start", "This visit cannot be started in its current state.");
          to = moved;
        } else if (v.status !== "in_progress") {
          throw Conflict("raqib.cannot_start", "This visit cannot be started in its current state.");
        }
        const siteVersion = await this.forms.publishedVersion(form.id);
        if (!siteVersion) throw Conflict("raqib.no_form", "No inspection form is published. Ask Quality Management to publish one.");
        const isFirst = form.id === required[0]!.id;
        const guardForm = isFirst ? await this.forms.defaultForm("guard") : null;
        const guardVersion = guardForm ? await this.forms.publishedVersion(guardForm.id) : null;
        // Deduction scoring applies once the client values are published; until then the earlier policy scores.
        const cfg = await this.scoring.latest();
        const issueNo = await this.counters.next("INS", Number(who.today.slice(0, 4)));
        const id = await this.repo.insert({
          visitId,
          formId: form.id,
          issueNo,
          formVersionId: siteVersion.id,
          guardFormVersionId: guardVersion?.id ?? null,
          scoringPolicy: cfg ? DEDUCTION_POLICY : DEFAULT_POLICY,
          scoringConfigId: cfg?.id ?? null,
          startedBy: who.userId,
        });
        const snapshot: NewItem[] = [];
        siteVersion.sections.forEach((sec, si) =>
          sec.items.forEach((it, ii) =>
            snapshot.push({
              kind: "site",
              sectionPos: si,
              sectionKey: sec.key,
              sectionTitle: sec.title,
              position: ii,
              key: it.key,
              text: it.text,
              weight: it.weight,
              answerType: it.type,
              required: it.required,
              na: it.na,
              evidenceOnNc: it.evidenceOnNc,
            }),
          ),
        );
        guardVersion?.sections.forEach((sec, si) =>
          sec.items.forEach((it, ii) =>
            snapshot.push({
              kind: "guard",
              sectionPos: si,
              sectionKey: sec.key,
              sectionTitle: sec.title,
              position: ii,
              key: it.key,
              text: it.text,
              weight: it.weight,
              answerType: it.type,
              required: it.required,
              na: false,
              evidenceOnNc: false,
            }),
          ),
        );
        await this.repo.insertItems(id, snapshot);
        if (to !== v.status) {
          await this.visits.update(visitId, { status: to });
          await this.visits.appendEvent({
            visitId,
            ...actorOf(who),
            action: "started",
            fromStatus: v.status,
            toStatus: to,
            detail: { formVersionId: siteVersion.id, form: `${form.code} v${siteVersion.version}`, issueNo },
          });
        }
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.inspection.started",
          resourceType: "raqib_inspection",
          resourceId: id,
          after: { visitId, issueNo, form: `${form.code} v${siteVersion.version}` },
        });
        i = (await this.repo.find(id))!;
      } else if (v.status !== "in_progress" && v.status !== "returned") {
        throw Conflict("raqib.cannot_start", "This inspection can no longer be edited.");
      }
      return this.assemble(i, (await this.visits.find(visitId))!, who);
    });
  }

  // ── answering ───────────────────────────────────────────────────────────

  /** The visit, locked, once the caller has been shown to own it and it is open for editing. */
  private async editableVisit(visitId: string, who: Access): Promise<VisitRecord> {
    const v = await this.requireVisit(visitId, true);
    if (!this.isInspector(who, v)) throw Forbidden("raqib.out_of_scope", "This inspection is not yours to edit.");
    if (v.status !== "in_progress" && v.status !== "returned") throw Conflict("raqib.inspection_locked", "This inspection can no longer be edited.");
    return v;
  }

  /** The inspection that owns `itemId` (when given), else the visit's first. */
  private async editable(visitId: string, who: Access, itemId?: string): Promise<{ v: VisitRecord; i: InspectionRecord }> {
    const v = await this.editableVisit(visitId, who);
    const i = itemId ? await this.repo.ofItem(itemId) : await this.repo.findByVisit(visitId, true);
    if (!i || i.visitId !== visitId)
      throw NotFound(itemId ? "raqib.item_not_found" : "raqib.inspection_not_started", itemId ? "Item not found." : "This visit has not been started.");
    return { v, i };
  }

  async saveAnswer(
    visitId: string,
    itemId: string,
    patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null },
    who: Access,
  ): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who, itemId);
      const item = (await this.repo.items(i.id)).find((x) => x.id === itemId && x.kind === "site");
      if (!item) throw NotFound("raqib.item_not_found", "Item not found.");
      if (v.status === "returned") {
        const flagged = (await this.repo.flags(i.id)).some((f) => f.itemId === itemId && f.round === v.round);
        if (!flagged) throw Conflict("raqib.item_locked", "Only the items the reviewer sent back can be changed.");
      }
      if (patch.value === "x" && !item.na) throw ValidationError("raqib.na_not_allowed", "Not applicable is not allowed for this item.");
      // The screen shows "Medium" until the inspector picks another level, so a violation is stored as Medium unless a level
      // was chosen: otherwise the screen and the deduction disagree (a violation that deducts nothing).
      let applied = patch;
      if (patch.value === "n" && patch.severity === undefined && !(await this.repo.answers(i.id)).get(itemId)?.severity) {
        applied = { ...patch, severity: "medium" };
      }
      await this.repo.upsertAnswer(i.id, itemId, applied, v.status === "returned" ? v.round + 1 : v.round, who.userId);
      return this.assemble(i, v, who);
    });
  }

  async setGuardScore(visitId: string, guardId: string, itemId: string, score: number, who: Access): Promise<InspectionView> {
    requireCan(who, "guardEval", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who, itemId);
      await this.requireGuardOnVisit(v, guardId);
      const item = (await this.repo.items(i.id)).find((x) => x.id === itemId && x.kind === "guard");
      if (!item) throw NotFound("raqib.item_not_found", "Criterion not found.");
      await this.repo.setGuardScore(i.id, guardId, itemId, score);
      return this.assemble(i, v, who);
    });
  }

  async setGuardNote(visitId: string, guardId: string, note: string, who: Access): Promise<InspectionView> {
    requireCan(who, "guardEval", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who);
      await this.requireGuardOnVisit(v, guardId);
      await this.repo.setGuardNote(i.id, guardId, note);
      return this.assemble(i, v, who);
    });
  }

  private async requireGuardOnVisit(v: VisitRecord, guardId: string): Promise<void> {
    if (!((await this.visits.guardIds([v.id])).get(v.id) ?? []).includes(guardId))
      throw ValidationError("raqib.guard_not_on_visit", "This guard is not on this visit.");
  }

  // ── submit ──────────────────────────────────────────────────────────────

  /**
   * Submit (or resubmit) the whole visit for review: every required form must be started and complete. The backend
   * recomputes every blocking issue; each inspection is scored and stored at this moment.
   */
  async submit(visitId: string, who: Access): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const v = await this.editableVisit(visitId, who);
      const required = await this.requiredForms(visitId);
      const records: InspectionRecord[] = [];
      const missing: string[] = [];
      for (const f of required) {
        const i = await this.repo.findByVisitForm(visitId, f.id, true);
        if (i) records.push(i);
        else missing.push(f.code);
      }
      if (!records.length) throw NotFound("raqib.inspection_not_started", "This visit has not been started.");
      if (missing.length) throw Conflict("raqib.form_not_started", "Every required form must be started before submitting.", { forms: missing });
      const views = await Promise.all(records.map((i) => this.assemble(i, v, who)));
      const issues = views.flatMap((view) => view.issues.map((x) => ({ ...x, form: view.form.code })));
      if (issues.length) throw Conflict("raqib.cannot_submit", "The inspection is not complete.", { issues });
      const resubmission = v.status === "returned";
      const now = this.clock.now();
      const pcts: Array<number | null> = [];
      for (const i of records) {
        const siteItems = (await this.repo.items(i.id)).filter((x) => x.kind === "site");
        const answers = await this.repo.answers(i.id);
        const result = await this.scoreOf(i, siteItems, answers);
        // one deduction per recorded violation (the table key enforces it); a resubmission recomputes the set
        if (i.scoringConfigId) await this.scoring.replaceDeductions(i.id, i.scoringConfigId, result.deductions ?? []);
        await this.repo.markSubmitted(
          i.id,
          result.pct,
          { compliant: result.compliant, nonCompliant: result.nonCompliant, na: result.na, total: result.total },
          now,
        );
        pcts.push(result.pct);
        await this.audit.record({
          actorId: who.userId,
          action: resubmission ? "raqib.inspection.resubmitted" : "raqib.inspection.submitted",
          resourceType: "raqib_inspection",
          resourceId: i.id,
          after: { scorePct: result.pct, ...result, scoringConfigId: i.scoringConfigId, issueNo: i.issueNo },
        });
      }
      const scorePct = visitScore(pcts);
      await this.visits.update(visitId, { status: "pending_review", ...(resubmission ? { round: v.round + 1 } : {}) });
      await this.visits.appendEvent({
        visitId,
        ...actorOf(who),
        action: resubmission ? "resubmitted" : "submitted",
        fromStatus: v.status,
        toStatus: "pending_review",
        detail: { scorePct, forms: records.map((i) => i.issueNo) },
      });
      await this.events.publish(inspectionSubmitted({ visitId, actorId: who.userId, resubmission }));
      return this.assemble((await this.repo.find(records[0]!.id))!, (await this.visits.find(visitId))!, who);
    });
  }

  /** Items sent back, answers, evidence and guard scores for the review screen (reviewers and the owner). */
  async forReview(visitId: string, who: Access): Promise<InspectionView> {
    return this.get(visitId, who);
  }

  /** Used by the evidence service: the visit/inspection an upload would attach to, validated for editing. */
  async assertEditable(inspectionId: string, who: Access, itemId?: string | null): Promise<{ v: VisitRecord; i: InspectionRecord; item: ItemRecord | null }> {
    const i = await this.repo.find(inspectionId);
    if (!i) throw NotFound("raqib.inspection_not_found", "Inspection not found.");
    const v = await this.editableVisit(i.visitId, who);
    let item: ItemRecord | null = null;
    if (itemId) {
      item = (await this.repo.items(inspectionId)).find((x) => x.id === itemId) ?? null;
      if (!item) throw NotFound("raqib.item_not_found", "Item not found.");
      if (v.status === "returned" && item.kind === "site") {
        const flagged = (await this.repo.flags(i.id)).some((f) => f.itemId === itemId && f.round === v.round);
        if (!flagged) throw Conflict("raqib.item_locked", "Only the items the reviewer sent back can be changed.");
      }
    }
    return { v, i, item };
  }

  async visitOf(inspectionId: string): Promise<VisitRecord | null> {
    const i = await this.repo.find(inspectionId);
    return i ? this.visits.find(i.visitId) : null;
  }

  /** Stored answers for a set of items (review and report read models). */
  answersOf(inspectionId: string): Promise<Map<string, AnswerRecord>> {
    return this.repo.answers(inspectionId);
  }
}
