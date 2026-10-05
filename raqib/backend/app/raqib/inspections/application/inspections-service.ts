import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { defineEvent } from "@core/contracts/domain-event.js";
import { actorOf, can, inScope, requireCan, type Access } from "@raqib/raqib/access/access.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { EvidenceRepository, type EvidenceRecord } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { FormsRepository } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { next as visitNext } from "@raqib/raqib/visits/domain/visit-state.js";
import { VisitsRepository, type VisitRecord } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { DEFAULT_POLICY, guardScore, policyFor, type Answer, type ScoreResult } from "../domain/scoring.js";
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
export interface InspectionView {
  id: string;
  visitId: string;
  ref: string;
  status: string;
  round: number;
  form: { versionId: string; code: string; version: string; name: L10n };
  sections: Array<{ key: string; title: L10n; items: ItemView[] }>;
  guardCriteria: Array<{ id: string; key: string; text: L10n }>;
  guards: GuardEvalView[];
  score: ScoreResult & { evidence: number };
  issues: Issue[];
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

  private async assemble(i: InspectionRecord, v: VisitRecord, who: Access): Promise<InspectionView> {
    const [items, answers, flags, ev, scores, notes] = await Promise.all([
      this.repo.items(i.id), this.repo.answers(i.id), this.repo.flags(i.id), this.evidence.forInspection(i.id), this.repo.guardScores(i.id), this.repo.guardNotes(i.id),
    ]);
    const version = await this.forms.version(i.formVersionId);
    const form = version ? await this.forms.form(version.formId) : null;
    const s = await this.settings.current();
    const uploaders = await this.people.findMany([...new Set(ev.map((e) => e.uploadedBy).filter((x): x is string => !!x))]);
    const byName = new Map(uploaders.map((p) => [p.userId, p.nameEn]));
    const evView = (e: EvidenceRecord): EvidenceView => ({ id: e.id, name: e.name, kind: e.kind, mime: e.mime, sizeBytes: e.sizeBytes, at: e.uploadedAt.toISOString(), by: e.uploadedBy ? (byName.get(e.uploadedBy) ?? null) : null });
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
        id: it.id, key: it.key, num, text: it.text, weight: it.weight, required: it.required, na: it.na, evidenceOnNc: it.evidenceOnNc,
        answer: a?.value ?? null, note: a?.note ?? "", severity: a?.severity ?? null, evidence: itemEvidence.map(evView),
        flagged: isFlagged && !fixed, fixed, locked: !editableState || (returned && !isFlagged),
      };
      const sec = sections.get(it.sectionPos) ?? { key: it.sectionKey, title: it.sectionTitle, items: [] };
      sec.items.push(view);
      sections.set(it.sectionPos, sec);
      facts.push({
        num, step: it.sectionPos, required: it.required, evidenceOnNc: it.evidenceOnNc, answer: view.answer, note: view.note,
        storedEvidence: itemEvidence.length, pendingEvidence: 0, flagged: isFlagged, touchedSinceFlag: fixed,
      });
    });

    const criteria = items.filter((x) => x.kind === "guard");
    const guardIds = (await this.visits.guardIds([v.id])).get(v.id) ?? [];
    const guards: GuardEvalView[] = guardIds.map((gid) => {
      const mineScores = scores.filter((x) => x.guardId === gid);
      const byItem = Object.fromEntries(mineScores.map((x) => [x.itemId, x.score]));
      const g = guardScore(criteria.map((c) => byItem[c.id] ?? null), criteria.length);
      return { guardId: gid, scores: byItem, note: notes.get(gid) ?? "", evidence: ev.filter((e) => e.guardId === gid && e.context === "guard_eval").map(evView), pct: g.pct, done: g.done, answered: g.n };
    });
    const guardNames = new Map((await this.projects.guards([v.projectId])).map((g) => [g.id, g.name.en]));
    const issues = submissionIssues(facts, guards.map((g) => ({ name: guardNames.get(g.guardId) ?? g.guardId, done: g.done || criteria.length === 0 })), { ncNote: s.insp.ncNote, ncEvidence: s.insp.ncEvidence });
    const result = policyFor(i.scoringPolicy).score(siteItems.map((it) => ({ weight: it.weight, answer: answers.get(it.id)?.value ?? null })));

    return {
      id: i.id, visitId: v.id, ref: v.ref, status: v.status, round: v.round,
      form: { versionId: i.formVersionId, code: form?.code ?? "", version: version?.version ?? "", name: form?.name ?? { ar: "", en: "" } },
      sections: [...sections.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x),
      guardCriteria: criteria.map((c) => ({ id: c.id, key: c.key, text: c.text })),
      guards,
      score: { ...result, pct: i.submittedAt && returned === false ? (i.scorePct ?? result.pct) : result.pct, evidence: ev.filter((e) => e.context === "answer").length },
      issues, editable: mine && editableState, submittedAt: i.submittedAt?.toISOString() ?? null, startedAt: i.startedAt.toISOString(),
    };
  }

  async get(visitId: string, who: Access): Promise<InspectionView> {
    return readInTenant(async () => {
      const v = await this.requireVisit(visitId);
      if (!this.canRead(who, v)) throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      const i = await this.repo.findByVisit(visitId);
      if (!i) throw NotFound("raqib.inspection_not_started", "This visit has not been started.");
      return this.assemble(i, v, who);
    });
  }

  // ── start ───────────────────────────────────────────────────────────────

  /**
   * Start (or continue) the inspection. Starting snapshots the published default form — and the guard form — into
   * the inspection, so later edits to a form can never change what this inspection means.
   */
  async start(visitId: string, who: Access): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const v = await this.requireVisit(visitId, true);
      if (v.inspectorId !== who.userId) throw Forbidden("raqib.out_of_scope", "This visit is not assigned to you.");
      let i = await this.repo.findByVisit(visitId, true);
      if (!i) {
        const to = visitNext(v.status, "start", true);
        if (!to) throw Conflict("raqib.cannot_start", "This visit cannot be started in its current state.");
        const siteForm = await this.forms.defaultForm("site");
        const siteVersion = siteForm ? await this.forms.publishedVersion(siteForm.id) : null;
        if (!siteForm || !siteVersion) throw Conflict("raqib.no_form", "No inspection form is published. Ask Quality Management to publish one.");
        const guardForm = await this.forms.defaultForm("guard");
        const guardVersion = guardForm ? await this.forms.publishedVersion(guardForm.id) : null;
        const id = await this.repo.insert({ visitId, formVersionId: siteVersion.id, guardFormVersionId: guardVersion?.id ?? null, scoringPolicy: DEFAULT_POLICY, startedBy: who.userId });
        const snapshot: NewItem[] = [];
        siteVersion.sections.forEach((sec, si) =>
          sec.items.forEach((it, ii) =>
            snapshot.push({ kind: "site", sectionPos: si, sectionKey: sec.key, sectionTitle: sec.title, position: ii, key: it.key, text: it.text, weight: it.weight, answerType: it.type, required: it.required, na: it.na, evidenceOnNc: it.evidenceOnNc }),
          ),
        );
        guardVersion?.sections.forEach((sec, si) =>
          sec.items.forEach((it, ii) =>
            snapshot.push({ kind: "guard", sectionPos: si, sectionKey: sec.key, sectionTitle: sec.title, position: ii, key: it.key, text: it.text, weight: it.weight, answerType: it.type, required: it.required, na: false, evidenceOnNc: false }),
          ),
        );
        await this.repo.insertItems(id, snapshot);
        await this.visits.update(visitId, { status: to });
        await this.visits.appendEvent({ visitId, ...actorOf(who), action: "started", fromStatus: v.status, toStatus: to, detail: { formVersionId: siteVersion.id, form: `${siteForm.code} v${siteVersion.version}` } });
        await this.audit.record({ actorId: who.userId, action: "raqib.inspection.started", resourceType: "raqib_inspection", resourceId: id, after: { visitId, form: `${siteForm.code} v${siteVersion.version}` } });
        i = (await this.repo.findByVisit(visitId))!;
      } else if (v.status !== "in_progress" && v.status !== "returned") {
        throw Conflict("raqib.cannot_start", "This inspection can no longer be edited.");
      }
      return this.assemble(i, (await this.visits.find(visitId))!, who);
    });
  }

  // ── answering ───────────────────────────────────────────────────────────

  private async editable(visitId: string, who: Access): Promise<{ v: VisitRecord; i: InspectionRecord }> {
    const v = await this.requireVisit(visitId, true);
    if (!this.isInspector(who, v)) throw Forbidden("raqib.out_of_scope", "This inspection is not yours to edit.");
    const i = await this.repo.findByVisit(visitId, true);
    if (!i) throw NotFound("raqib.inspection_not_started", "This visit has not been started.");
    if (v.status !== "in_progress" && v.status !== "returned") throw Conflict("raqib.inspection_locked", "This inspection can no longer be edited.");
    return { v, i };
  }

  async saveAnswer(visitId: string, itemId: string, patch: { value?: Answer; note?: string | null; severity?: "low" | "medium" | "high" | null }, who: Access): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who);
      const item = (await this.repo.items(i.id)).find((x) => x.id === itemId && x.kind === "site");
      if (!item) throw NotFound("raqib.item_not_found", "Item not found.");
      if (v.status === "returned") {
        const flagged = (await this.repo.flags(i.id)).some((f) => f.itemId === itemId && f.round === v.round);
        if (!flagged) throw Conflict("raqib.item_locked", "Only the items the reviewer sent back can be changed.");
      }
      if (patch.value === "x" && !item.na) throw ValidationError("raqib.na_not_allowed", "Not applicable is not allowed for this item.");
      await this.repo.upsertAnswer(i.id, itemId, patch, v.status === "returned" ? v.round + 1 : v.round, who.userId);
      return this.assemble(i, v, who);
    });
  }

  async setGuardScore(visitId: string, guardId: string, itemId: string, score: number, who: Access): Promise<InspectionView> {
    requireCan(who, "guardEval", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who);
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
    if (!((await this.visits.guardIds([v.id])).get(v.id) ?? []).includes(guardId)) throw ValidationError("raqib.guard_not_on_visit", "This guard is not on this visit.");
  }

  // ── submit ──────────────────────────────────────────────────────────────

  /** Submit (or resubmit) for review. The backend recomputes every blocking issue; the score is stored at this moment. */
  async submit(visitId: string, who: Access): Promise<InspectionView> {
    requireCan(who, "inspections", "S");
    return this.uow.transaction(async () => {
      const { v, i } = await this.editable(visitId, who);
      const view = await this.assemble(i, v, who);
      if (view.issues.length) throw Conflict("raqib.cannot_submit", "The inspection is not complete.", { issues: view.issues });
      const resubmission = v.status === "returned";
      const now = this.clock.now();
      const siteItems = (await this.repo.items(i.id)).filter((x) => x.kind === "site");
      const answers = await this.repo.answers(i.id);
      const result = policyFor(i.scoringPolicy).score(siteItems.map((it) => ({ weight: it.weight, answer: answers.get(it.id)?.value ?? null })));
      await this.repo.markSubmitted(i.id, result.pct, { compliant: result.compliant, nonCompliant: result.nonCompliant, na: result.na, total: result.total }, now);
      await this.visits.update(visitId, { status: "pending_review", ...(resubmission ? { round: v.round + 1 } : {}) });
      await this.visits.appendEvent({ visitId, ...actorOf(who), action: resubmission ? "resubmitted" : "submitted", fromStatus: v.status, toStatus: "pending_review", detail: { scorePct: result.pct } });
      await this.audit.record({ actorId: who.userId, action: resubmission ? "raqib.inspection.resubmitted" : "raqib.inspection.submitted", resourceType: "raqib_inspection", resourceId: i.id, after: { scorePct: result.pct, ...result } });
      await this.events.publish(inspectionSubmitted({ visitId, actorId: who.userId, resubmission }));
      return this.assemble((await this.repo.findByVisit(visitId))!, (await this.visits.find(visitId))!, who);
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
    const { v } = await this.editable(i.visitId, who);
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
