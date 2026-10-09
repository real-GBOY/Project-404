import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { actorOf, can, inScope, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { initialStatus, isEscalated, letterForTraining, nextTraining, type TrainingStep } from "../domain/training-state.js";
import { trainingApproved, trainingCompleted, trainingDecided, trainingRequested, trainingReviewed, trainingScheduled } from "../events.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { TrainingRepository, type Priority, type TrainingReason, type TrainingRecord, type TrainingResult } from "../infrastructure/training-repository.js";
import type { Page } from "@raqib/raqib/shared/paging.js";

export interface TrainingLogEntry {
  id: string;
  kind: string;
  to: string;
  text: string | null;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}

export interface TrainingView {
  id: string;
  ref: string;
  guard: { id: string; employeeNo: string; name: L10n };
  project: { id: string; code: string; name: L10n };
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Priority;
  notes: string;
  status: TrainingRecord["status"];
  /** Who asked, which decides the approval chain: a supervisor, or a guard for themselves. */
  requesterKind: TrainingRecord["requesterKind"];
  round: number;
  escalated: boolean;
  requestedBy: L10n | null;
  requestedById: string | null;
  scheduledDate: string | null;
  provider: string | null;
  completedDate: string | null;
  result: TrainingResult | null;
  resultNote: string | null;
  createdAt: string;
  log?: TrainingLogEntry[];
}

export interface CreateTrainingInput {
  guardId?: string;
  reason: TrainingReason;
  course: string;
  related: string;
  priority: Priority;
  notes: string;
}

export interface StepInput {
  text?: string;
  notes?: string;
  date?: string;
  provider?: string;
  result?: TrainingResult;
}

const PROVIDERS = ["internal", "academy", "external"];

/**
 * Training requests. A supervisor's request goes to the project manager; a guard's request is reviewed by a supervisor
 * first (switchable in settings) and then goes to the project manager. Once approved it is with Quality Management,
 * which schedules the training and records the result. Every step is one transaction writing the immutable event, audit
 * entry and domain event. A guard sees and asks only for themselves.
 */
@Injectable()
export class TrainingService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly projects: ProjectsRepository,
    private readonly access: AccessService,
    private readonly counters: Counters,
    private readonly settings: SettingsService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** A guard account's own roster record (the only employee a guard may ask training for). */
  private async ownGuard(who: Access) {
    return (await this.projects.guards()).find((g) => g.userId === who.userId) ?? null;
  }

  async list(who: Access, guardId?: string, page?: Page): Promise<TrainingView[]> {
    requireCan(who, "training", "V");
    return readInTenant(async () => {
      if (who.role === "guard") {
        const mine = await this.ownGuard(who);
        return mine ? this.views(await this.repo.list(undefined, mine.id, page), who, false) : [];
      }
      return this.views(await this.repo.list(who.allProjects ? undefined : [...who.projectIds], guardId, page), who, false);
    });
  }

  async get(id: string, who: Access): Promise<TrainingView> {
    return readInTenant(async () => (await this.views([await this.readable(id, who)], who, true))[0]!);
  }

  async create(input: CreateTrainingInput, who: Access): Promise<TrainingView> {
    requireCan(who, "training", "A");
    const course = input.course.trim();
    if (!course) throw ValidationError("raqib.course_required", "Name the course.");
    const id = await this.uow.transaction(async () => {
      const kind = who.role === "guard" ? ("guard" as const) : ("supervisor" as const);
      // a guard asks for themselves: the employee is their own roster record, never one they name
      const g = kind === "guard" ? await this.ownGuard(who) : input.guardId ? await this.projects.findGuard(input.guardId) : null;
      if (!g) throw NotFound("raqib.guard_not_found", kind === "guard" ? "Your account is not linked to a guard record." : "Guard not found.");
      if (kind === "supervisor") requireProject(who, g.projectId);
      if (g.status !== "active") throw ValidationError("raqib.guard_inactive", "This guard is not active.");
      const start = initialStatus(kind, (await this.settings.current()).training.guardReviewBySupervisor);
      const ref = await this.counters.next("TR", Number(who.today.slice(0, 4)));
      const id = await this.repo.insert({
        ref,
        guardId: g.id,
        projectId: g.projectId,
        reason: input.reason,
        course,
        related: input.related.trim(),
        priority: input.priority,
        notes: input.notes.trim(),
        requestedBy: who.userId,
        requesterKind: kind,
        status: start,
      });
      await this.repo.appendEvent({
        requestId: id,
        kind: "requested",
        fromStatus: null,
        toStatus: start,
        text: input.notes.trim() || null,
        ...actorOf(who),
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.training.requested",
        resourceType: "raqib_training",
        resourceId: id,
        after: { ref, guardId: g.id, course, requesterKind: kind, status: start },
      });
      await this.events.publish(trainingRequested({ requestId: id, actorId: who.userId }));
      return id;
    });
    return this.get(id, who);
  }

  async step(id: string, step: TrainingStep, input: StepInput, who: Access): Promise<TrainingView> {
    const text = (input.text ?? "").trim();
    if ((step === "return" || step === "reject") && text.length < 3) throw ValidationError("raqib.reason_required", "A reason is required.");
    await this.uow.transaction(async () => {
      const t = await this.repo.find(id, true);
      if (!t) throw NotFound("raqib.training_not_found", "Training request not found.");
      requireProject(who, t.projectId);
      const start = initialStatus(t.requesterKind, (await this.settings.current()).training.guardReviewBySupervisor);
      const to = nextTraining(t.status, step, start);
      if (!to) throw Conflict("raqib.invalid_transition", "This is not possible in the request's current state.");
      requireCan(who, "training", letterForTraining(step, t.status));
      if (step === "resubmit" && t.requestedBy !== who.userId) throw Forbidden("raqib.not_requester", "Only the person who asked can resubmit.");
      if ((step === "review" || step === "approve" || step === "return" || step === "reject") && t.requestedBy === who.userId)
        throw Forbidden("raqib.self_review", "You cannot decide your own request.");
      const patch: Parameters<TrainingRepository["update"]>[1] = { status: to };
      if (step === "resubmit") {
        patch.round = t.round + 1;
        if (input.notes !== undefined) patch.notes = input.notes.trim();
      }
      if (step === "schedule") {
        if (!input.date || input.date < who.today) throw ValidationError("raqib.date_in_past", "Choose today or a later date.");
        if (!input.provider || !PROVIDERS.includes(input.provider)) throw ValidationError("raqib.provider_required", "Choose the training provider.");
        patch.scheduledDate = input.date;
        patch.provider = input.provider;
      }
      if (step === "complete") {
        if (!input.date || input.date > who.today) throw ValidationError("raqib.date_in_future", "The completion date cannot be in the future.");
        if (!input.result) throw ValidationError("raqib.result_required", "Record the result.");
        patch.completedDate = input.date;
        patch.result = input.result;
        patch.resultNote = text || null;
      }
      await this.repo.update(t.id, patch);
      const kind = (
        {
          review: "reviewed",
          approve: "approved",
          return: "returned",
          reject: "rejected",
          resubmit: "resubmitted",
          schedule: "scheduled",
          complete: "completed",
        } as const
      )[step];
      await this.repo.appendEvent({
        requestId: t.id,
        kind,
        fromStatus: t.status,
        toStatus: to,
        text: step === "resubmit" ? input.notes?.trim() || null : text || null,
        ...actorOf(who),
      });
      await this.audit.record({
        actorId: who.userId,
        action: `raqib.training.${kind}`,
        resourceType: "raqib_training",
        resourceId: t.id,
        before: { status: t.status },
        after: { status: to },
      });
      const base = { requestId: t.id, actorId: who.userId };
      if (step === "resubmit") await this.events.publish(trainingRequested(base));
      if (step === "review") await this.events.publish(trainingReviewed(base));
      if (step === "approve") await this.events.publish(trainingApproved(base));
      if (step === "return" || step === "reject") await this.events.publish(trainingDecided({ ...base, decision: kind, reason: text }));
      if (step === "schedule") await this.events.publish(trainingScheduled(base));
      if (step === "complete") await this.events.publish(trainingCompleted(base));
    });
    return this.get(id, who);
  }

  async readable(id: string, who: Access): Promise<TrainingRecord> {
    if (!can(who, "training", "V")) throw Forbidden("raqib.forbidden", "Your role is not permitted to do this (training:V).");
    const t = await this.repo.find(id);
    if (!t) throw NotFound("raqib.training_not_found", "Training request not found.");
    if (who.role === "guard") {
      // a guard reads only their own requests
      if (t.requestedBy !== who.userId) throw Forbidden("raqib.out_of_scope", "This request is not yours.");
      return t;
    }
    if (!inScope(who, t.projectId)) throw Forbidden("raqib.out_of_scope", "This request belongs to a project outside your scope.");
    return t;
  }

  private async views(rows: TrainingRecord[], who: Access, detail: boolean): Promise<TrainingView[]> {
    const projects = new Map((await this.projects.list()).map((p) => [p.id, p]));
    const guards = new Map((await this.projects.guards()).map((g) => [g.id, g]));
    const names = new Map<string, L10n>();
    const nameOf = async (userId: string): Promise<L10n> => {
      if (!names.has(userId)) {
        const p = await this.access.profileOf(userId);
        names.set(userId, p ? { ar: p.nameAr, en: p.nameEn } : { ar: "—", en: "—" });
      }
      return names.get(userId)!;
    };
    const out: TrainingView[] = [];
    for (const r of rows) {
      const g = guards.get(r.guardId);
      const p = projects.get(r.projectId);
      const view: TrainingView = {
        id: r.id,
        ref: r.ref,
        guard: { id: r.guardId, employeeNo: g?.employeeNo ?? "", name: g?.name ?? { ar: "—", en: "—" } },
        project: { id: r.projectId, code: p?.code ?? "", name: p?.name ?? { ar: "—", en: "—" } },
        reason: r.reason,
        course: r.course,
        related: r.related,
        priority: r.priority,
        notes: r.notes,
        status: r.status,
        requesterKind: r.requesterKind,
        round: r.round,
        escalated: isEscalated(r.status, r.updatedAt.toISOString(), who.today),
        requestedBy: r.requestedBy ? await nameOf(r.requestedBy) : null,
        requestedById: r.requestedBy,
        scheduledDate: r.scheduledDate,
        provider: r.provider,
        completedDate: r.completedDate,
        result: r.result,
        resultNote: r.resultNote,
        createdAt: r.createdAt.toISOString(),
      };
      if (detail) {
        view.log = (await this.repo.events(r.id)).map((e) => ({
          id: e.id,
          kind: e.kind,
          to: e.toStatus,
          text: e.text,
          at: e.at.toISOString(),
          actor: { id: e.actorId, name: { ar: e.actorNameAr, en: e.actorNameEn }, role: e.actorRole, title: { ar: e.actorTitleAr, en: e.actorTitleEn } },
        }));
      }
      out.push(view);
    }
    return out;
  }
}
