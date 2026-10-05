import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { actorOf, can, inScope, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { EvidenceRepository } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { ObservationsRepository, type ObservationRecord } from "@raqib/raqib/observations/infrastructure/observations-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { effectiveActionStatus, letterForStep, nextAction, type ActionStep, type DisplayActionStatus } from "../domain/action-state.js";
import { actionAssigned, actionClosed, actionReturned, actionSubmitted } from "../events.js";
import { ActionsRepository, type ActionRecord, type Priority } from "../infrastructure/actions-repository.js";

export interface ActionLogEntry {
  id: string;
  kind: string;
  from: string | null;
  to: string | null;
  text: string | null;
  at: string;
  actor: { id: string | null; name: L10n; role: string | null; title: L10n };
}

export interface ActionView {
  id: string;
  ref: string;
  title: L10n;
  description: string;
  priority: Priority;
  status: DisplayActionStatus;
  storedStatus: ActionRecord["status"];
  dueDate: string;
  round: number;
  project: { id: string; code: string; name: L10n };
  responsible: { id: string; name: L10n };
  observation: { id: string; ref: string; kind: string; severity: string; repeatCount: number; itemNum: string | null; site: L10n };
  visit: { id: string; ref: string } | null;
  createdAt: string;
  closedAt: string | null;
  /** Detail only. */
  log?: ActionLogEntry[];
  evidence?: Array<{ id: string; name: string; kind: "photo" | "video" | "doc"; mime: string; sizeBytes: number; at: string; by: string | null }>;
}

export interface CreateActionInput {
  responsibleId: string;
  dueDate: string;
  priority: Priority;
  description: string;
}

/**
 * Corrective actions. The responsible person does the work and hands it over with closure evidence; quality
 * reviews it (return with a reason) and a person with the approve right closes it. Nobody reviews their own
 * action; every step is one transaction writing the immutable event, audit entry and domain event.
 */
@Injectable()
export class ActionsService {
  constructor(
    private readonly repo: ActionsRepository,
    private readonly observations: ObservationsRepository,
    private readonly evidence: EvidenceRepository,
    private readonly projects: ProjectsRepository,
    private readonly visits: VisitsRepository,
    private readonly access: AccessService,
    private readonly counters: Counters,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ── reads ───────────────────────────────────────────────────────────────

  async list(who: Access): Promise<ActionView[]> {
    requireCan(who, "actions", "V");
    return readInTenant(async () => {
      const rows = await this.repo.list(who.allProjects ? undefined : [...who.projectIds]);
      return this.views(rows, who, false);
    });
  }

  async get(id: string, who: Access): Promise<ActionView> {
    return readInTenant(async () => {
      const a = await this.readable(id, who);
      return (await this.views([a], who, true))[0]!;
    });
  }

  /** People who may be given an action on a project: those whose live template lets them work actions in it. */
  async eligibleResponsible(who: Access, projectId: string | undefined): Promise<Array<{ id: string; name: L10n; title: L10n }>> {
    requireCan(who, "actions", "A");
    if (!projectId) return [];
    requireProject(who, projectId);
    const ids = await this.access.holders("actions", "S", projectId, who.today);
    const out: Array<{ id: string; name: L10n; title: L10n }> = [];
    for (const id of ids) {
      const p = await this.access.profileOf(id);
      if (p) out.push({ id, name: { ar: p.nameAr, en: p.nameEn }, title: { ar: p.titleAr, en: p.titleEn } });
    }
    return out;
  }

  // ── writes ──────────────────────────────────────────────────────────────

  async create(observationId: string, input: CreateActionInput, who: Access): Promise<ActionView> {
    requireCan(who, "actions", "A");
    const id = await this.uow.transaction(async () => {
      const o = await this.observations.find(observationId);
      if (!o) throw NotFound("raqib.observation_not_found", "Observation not found.");
      requireProject(who, o.projectId);
      if (await this.repo.findByObservation(o.id)) throw Conflict("raqib.action_exists", "This observation already has a corrective action.");
      if (input.dueDate < who.today) throw ValidationError("raqib.due_in_past", "The due date cannot be in the past.");
      const eligible = await this.access.holders("actions", "S", o.projectId, who.today);
      if (!eligible.includes(input.responsibleId)) throw ValidationError("raqib.invalid_responsible", "This person cannot be given actions on this project.");
      const ref = await this.counters.next("CA", Number(who.today.slice(0, 4)));
      const actionId = await this.repo.insert({
        ref, observationId: o.id, projectId: o.projectId, title: o.title, description: input.description, priority: input.priority,
        responsibleId: input.responsibleId, dueDate: input.dueDate, createdBy: who.userId,
      });
      await this.repo.appendEvent({ actionId, kind: "created", fromStatus: null, toStatus: "assigned", text: input.description || null, ...actorOf(who) });
      await this.audit.record({ actorId: who.userId, action: "raqib.action.created", resourceType: "raqib_action", resourceId: actionId, after: { ref, observationId: o.id, responsibleId: input.responsibleId, dueDate: input.dueDate } });
      await this.events.publish(actionAssigned({ actionId, actorId: who.userId }));
      return actionId;
    });
    return this.get(id, who);
  }

  async step(id: string, step: ActionStep, input: { text?: string }, who: Access): Promise<ActionView> {
    const text = (input.text ?? "").trim();
    if (step === "return" && text.length < 3) throw ValidationError("raqib.reason_required", "A reason is required to return an action.");
    await this.uow.transaction(async () => {
      const a = await this.repo.find(id, true);
      if (!a) throw NotFound("raqib.action_not_found", "Action not found.");
      requireProject(who, a.projectId);
      const to = nextAction(a.status, step);
      if (!to) throw Conflict("raqib.invalid_transition", "This is not possible in the action's current state.");
      requireCan(who, "actions", letterForStep(step));
      if ((step === "start" || step === "submit") && a.responsibleId !== who.userId) throw Forbidden("raqib.not_responsible", "Only the person responsible can do this.");
      if ((step === "return" || step === "close") && a.responsibleId === who.userId) throw Forbidden("raqib.self_review", "You cannot review your own action.");
      const now = new Date();
      if (step === "submit") {
        const events = await this.repo.events(a.id);
        const since = [...events].reverse().find((e) => e.kind === "returned" || e.kind === "created")?.at ?? a.createdAt;
        const fresh = (await this.evidence.forRef("corrective_action", a.id)).filter((e) => e.uploadedAt >= since);
        if (!fresh.length) throw ValidationError("raqib.evidence_required", "Attach closure evidence before handing this over for review.");
      }
      await this.repo.update(a.id, {
        status: to,
        ...(step === "start" ? { startedAt: now, ...(a.status === "returned" ? { round: a.round + 1 } : {}) } : {}),
        ...(step === "submit" ? { submittedAt: now } : {}),
        ...(step === "close" ? { closedAt: now } : {}),
      });
      const kind = ({ start: "started", submit: "submitted", return: "returned", close: "closed" } as const)[step];
      await this.repo.appendEvent({ actionId: a.id, kind, fromStatus: a.status, toStatus: to, text: text || null, ...actorOf(who) });
      await this.audit.record({ actorId: who.userId, action: `raqib.action.${kind}`, resourceType: "raqib_action", resourceId: a.id, before: { status: a.status }, after: { status: to }, metadata: { reason: text || null } });
      const base = { actionId: a.id, actorId: who.userId };
      if (step === "submit") await this.events.publish(actionSubmitted(base));
      if (step === "return") await this.events.publish(actionReturned({ ...base, reason: text }));
      if (step === "close") await this.events.publish(actionClosed(base));
    });
    return this.get(id, who);
  }

  async comment(id: string, text: string, who: Access): Promise<ActionView> {
    await this.uow.transaction(async () => {
      const a = await this.readable(id, who);
      await this.repo.appendEvent({ actionId: a.id, kind: "comment", fromStatus: null, toStatus: null, text, ...actorOf(who) });
      await this.audit.record({ actorId: who.userId, action: "raqib.action.commented", resourceType: "raqib_action", resourceId: a.id });
    });
    return this.get(id, who);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Readable = the module's V right in a project in scope (the responsible person always has both through their template). */
  async readable(id: string, who: Access): Promise<ActionRecord> {
    if (!can(who, "actions", "V")) throw Forbidden("raqib.forbidden", "Your role is not permitted to do this (actions:V).");
    const a = await this.repo.find(id);
    if (!a) throw NotFound("raqib.action_not_found", "Action not found.");
    if (!inScope(who, a.projectId)) throw Forbidden("raqib.out_of_scope", "This action belongs to a project outside your scope.");
    return a;
  }

  private async views(rows: ActionRecord[], who: Access, detail: boolean): Promise<ActionView[]> {
    const projects = new Map((await this.projects.list()).map((p) => [p.id, p]));
    const sites = new Map((await this.projects.sites()).map((s) => [s.id, s]));
    const obs = new Map<string, ObservationRecord>();
    for (const r of rows) {
      const o = await this.observations.find(r.observationId);
      if (o) obs.set(r.id, o);
    }
    const names = new Map<string, L10n>();
    const nameOf = async (userId: string): Promise<L10n> => {
      if (!names.has(userId)) {
        const p = await this.access.profileOf(userId);
        names.set(userId, p ? { ar: p.nameAr, en: p.nameEn } : { ar: "—", en: "—" });
      }
      return names.get(userId)!;
    };
    const out: ActionView[] = [];
    for (const r of rows) {
      const o = obs.get(r.id);
      const p = projects.get(r.projectId);
      const visit = o?.visitId ? await this.visits.find(o.visitId) : null;
      const view: ActionView = {
        id: r.id, ref: r.ref, title: r.title, description: r.description, priority: r.priority,
        status: effectiveActionStatus(r.status, r.dueDate, who.today), storedStatus: r.status, dueDate: r.dueDate, round: r.round,
        project: { id: r.projectId, code: p?.code ?? "", name: p?.name ?? { ar: "—", en: "—" } },
        responsible: { id: r.responsibleId, name: await nameOf(r.responsibleId) },
        observation: {
          id: r.observationId, ref: o?.ref ?? "", kind: o?.kind ?? "violation", severity: o?.severity ?? "medium", repeatCount: o?.repeatCount ?? 0,
          itemNum: o?.itemNum ?? null, site: (o && sites.get(o.siteId)?.name) || { ar: "—", en: "—" },
        },
        visit: visit ? { id: visit.id, ref: visit.ref } : null,
        createdAt: r.createdAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null,
      };
      if (detail) {
        view.log = (await this.repo.events(r.id)).map((e) => ({
          id: e.id, kind: e.kind, from: e.fromStatus, to: e.toStatus, text: e.text, at: e.at.toISOString(),
          actor: { id: e.actorId, name: { ar: e.actorNameAr, en: e.actorNameEn }, role: e.actorRole, title: { ar: e.actorTitleAr, en: e.actorTitleEn } },
        }));
        const ev = await this.evidence.forRef("corrective_action", r.id);
        view.evidence = [];
        for (const e of ev) {
          view.evidence.push({ id: e.id, name: e.name, kind: e.kind, mime: e.mime, sizeBytes: e.sizeBytes, at: e.uploadedAt.toISOString(), by: e.uploadedBy ? (await nameOf(e.uploadedBy)).en : null });
        }
      }
      out.push(view);
    }
    return out;
  }
}
