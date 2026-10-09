import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { actorOf, inScope, canSeeScore, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import { isUniqueViolation } from "@raqib/raqib/shared/pg-errors.js";
import { addDays, isIsoDate } from "@raqib/raqib/shared/dates.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { initials } from "@raqib/raqib/shared/l10n.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { BrandingService } from "@raqib/raqib/shared/branding.js";
import { FormsRepository } from "@raqib/raqib/forms/infrastructure/forms-repository.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { visitAssigned, visitCancelled, visitRescheduled, visitUnassigned } from "../events.js";
import { renderScheduleHtml, scheduleCsv, type ScheduleRow } from "../domain/schedule-print.js";
import { csvField } from "@raqib/raqib/shared/csv.js";
import { lookAroundDays, ruleViolations } from "../domain/schedule-rules.js";
import { effectiveStatus, isChangeable, next, type DisplayStatus, type VisitStatus } from "../domain/visit-state.js";
import {
  VisitsRepository,
  type Shift,
  type VisitEventRecord,
  type VisitFilter,
  type VisitRecord,
  type VisitType,
} from "../infrastructure/visits-repository.js";
import type { Page } from "@raqib/raqib/shared/paging.js";

export interface VisitView {
  id: string;
  ref: string;
  project: { id: string; code: string; name: L10n };
  site: { id: string; name: L10n };
  /** Master-data area name, or the free text the scheduler typed. */
  area: L10n | string | null;
  inspector: { id: string; name: L10n; ini: L10n } | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  /** What to show (overdue is derived). */
  status: DisplayStatus;
  storedStatus: VisitStatus;
  round: number;
  guardIds: string[];
  /** The forms this visit uses, in order: the ones the scheduler named, else the default site form. */
  forms: Array<{ id: string; code: string; name: L10n }>;
  /** Stored score of the submitted inspection (null until submitted, or when not scoreable). */
  scorePct: number | null;
  /** Violations and evidence on the visit's inspections (null until an inspection has started). */
  nonCompliant: number | null;
  evidence: number | null;
  inspectionId: string | null;
  history: Array<{
    action: string;
    from: string | null;
    to: string;
    at: string;
    reason: string | null;
    actor: { id: string | null; name: L10n; role: string | null; title: L10n };
  }>;
  createdAt: string;
}

export interface CreateVisitInput {
  projectId: string;
  siteId: string;
  areaId?: string | null;
  areaText?: string | null;
  inspectorId?: string | null;
  type: VisitType;
  shift: Shift;
  date: string;
  time: string;
  guardIds?: string[];
  /** Forms the inspector must complete on this visit, in order. Empty/absent = the default site form. */
  formIds?: string[];
  reason: string;
}
export interface RescheduleInput {
  date: string;
  time: string;
  inspectorId?: string | null;
  reason: string;
}

@Injectable()
export class VisitsService {
  constructor(
    private readonly repo: VisitsRepository,
    private readonly people: PeopleRepository,
    private readonly projects: ProjectsRepository,
    private readonly settings: SettingsService,
    private readonly forms: FormsRepository,
    private readonly branding: BrandingService,
    private readonly counters: Counters,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Project scope AND, for inspectors, ownership: an inspector sees only the visits assigned to them. */
  private visible(who: Access, v: VisitRecord): boolean {
    return inScope(who, v.projectId) && (who.role !== "ins" || v.inspectorId === who.userId);
  }

  private async assemble(records: VisitRecord[], who: Access): Promise<VisitView[]> {
    if (!records.length) return [];
    const s = await this.settings.current();
    const now = this.clock.now();
    const [projects, sites, areas, guards, events, profiles, scores, counts, formIds, allForms] = await Promise.all([
      this.projects.list(),
      this.projects.sites(),
      this.projects.areasBySite(),
      this.repo.guardIds(records.map((r) => r.id)),
      this.repo.events(records.map((r) => r.id)),
      this.people.findMany([...new Set(records.map((r) => r.inspectorId).filter((x): x is string => !!x))]),
      this.repo.scores(records.map((r) => r.id)),
      this.repo.findingCounts(records.map((r) => r.id)),
      this.repo.formIds(records.map((r) => r.id)),
      this.forms.forms(),
    ]);
    const fMap = new Map(allForms.map((f) => [f.id, f]));
    const defaultSite = allForms.find((f) => f.category === "site" && f.isDefault) ?? null;
    const pMap = new Map(projects.map((p) => [p.id, p]));
    const sMap = new Map(sites.map((x) => [x.id, x]));
    const aMap = new Map(areas.map((a) => [a.id, a]));
    const iMap = new Map(profiles.map((p) => [p.userId, p]));
    return records.map((r) => {
      const p = pMap.get(r.projectId);
      const site = sMap.get(r.siteId);
      const area = r.areaId ? (aMap.get(r.areaId)?.name ?? null) : r.areaText;
      const insp = r.inspectorId ? iMap.get(r.inspectorId) : undefined;
      return {
        id: r.id,
        ref: r.ref,
        project: { id: r.projectId, code: p?.code ?? "", name: p?.name ?? { ar: "", en: "" } },
        site: { id: r.siteId, name: site?.name ?? { ar: "", en: "" } },
        area,
        inspector: insp ? { id: insp.userId, name: { ar: insp.nameAr, en: insp.nameEn }, ini: { ar: initials(insp.nameAr), en: initials(insp.nameEn) } } : null,
        type: r.type,
        shift: r.shift,
        date: r.date,
        time: r.time,
        status: effectiveStatus({ status: r.status, date: r.date, time: r.time }, now, s.insp.overdueHours, s.org.tz),
        storedStatus: r.status,
        round: r.round,
        guardIds: guards.get(r.id) ?? [],
        forms: ((formIds.get(r.id) ?? []).length ? formIds.get(r.id)! : defaultSite ? [defaultSite.id] : []).flatMap((id) => {
          const f = fMap.get(id);
          return f ? [{ id, code: f.code, name: f.name }] : [];
        }),
        scorePct: canSeeScore(who) ? (scores.get(r.id)?.scorePct ?? null) : null,
        nonCompliant: scores.has(r.id) ? (counts.get(r.id)?.nonCompliant ?? 0) : null,
        evidence: scores.has(r.id) ? (counts.get(r.id)?.evidence ?? 0) : null,
        inspectionId: scores.get(r.id)?.inspectionId ?? null,
        history: (events.get(r.id) ?? []).map((e: VisitEventRecord) => ({
          action: e.action,
          from: e.fromStatus,
          to: e.toStatus,
          at: e.at.toISOString(),
          reason: e.reason,
          actor: { id: e.actorId, name: { ar: e.actorNameAr, en: e.actorNameEn }, role: e.actorRole, title: { ar: e.actorTitleAr, en: e.actorTitleEn } },
        })),
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async list(who: Access, q: { projectId?: string; from?: string; to?: string } = {}, page?: Page): Promise<VisitView[]> {
    requireCan(who, "visits", "V");
    return readInTenant(async () => {
      const filter: VisitFilter = { from: q.from, to: q.to };
      if (q.projectId) {
        requireProject(who, q.projectId);
        filter.projectIds = [q.projectId];
      } else if (!who.allProjects) filter.projectIds = [...who.projectIds];
      if (who.role === "ins") filter.inspectorId = who.userId;
      return this.assemble(await this.repo.list(filter, page), who);
    });
  }

  async get(id: string, who: Access): Promise<VisitView> {
    requireCan(who, "visits", "V");
    return readInTenant(async () => {
      const v = await this.repo.find(id);
      if (!v) throw NotFound("raqib.visit_not_found", "Visit not found.");
      if (!this.visible(who, v)) throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      return (await this.assemble([v], who))[0]!;
    });
  }

  // ── scheduling ──────────────────────────────────────────────────────────

  private async requireEligibleInspector(inspectorId: string, projectId: string, date: string): Promise<void> {
    const p = await this.people.find(inspectorId);
    const ok = p && p.roleKey === "ins" && p.status === "active" && (await this.people.activeProjectIds(inspectorId, date)).includes(projectId);
    if (!ok) throw ValidationError("raqib.inspector_not_eligible", "The inspector is not an active inspector assigned to this project.");
  }

  /** The shift must be one the organization has configured; the rest/consecutive rules then apply per inspector. */
  private async requireScheduleRules(
    slot: { date: string; time: string; shift: string },
    inspectorId: string | null | undefined,
    excludeVisitId?: string,
  ): Promise<void> {
    const { schedule } = await this.settings.current();
    if (!schedule.shifts.some((s) => s.key === slot.shift)) throw ValidationError("raqib.unknown_shift", "This shift is not configured.");
    if (!inspectorId || (schedule.minRestHours === 0 && schedule.maxConsecutiveDays === 0)) return;
    const span = lookAroundDays(schedule);
    const existing = await this.repo.liveSlots(inspectorId, addDays(slot.date, -span), addDays(slot.date, span), excludeVisitId);
    const found = ruleViolations(slot, existing, schedule.shifts, schedule);
    if (found.length) {
      const first = found[0]!;
      throw Conflict(
        first.rule === "rest" ? "raqib.rest_rule" : "raqib.consecutive_rule",
        first.rule === "rest"
          ? `The inspector must have at least ${schedule.minRestHours} hours between assignments.`
          : `The inspector cannot be assigned more than ${schedule.maxConsecutiveDays} days in a row.`,
        { violations: found },
      );
    }
  }

  private requireFuture(date: string, time: string, today: string): void {
    if (!isIsoDate(date)) throw ValidationError("raqib.bad_date", "Invalid date.");
    if (date < today) throw ValidationError("raqib.date_in_past", "A visit cannot be scheduled in the past.");
    void time;
  }

  async create(input: CreateVisitInput, who: Access): Promise<VisitView> {
    requireCan(who, "visits", "A");
    requireProject(who, input.projectId);
    this.requireFuture(input.date, input.time, who.today);
    try {
      return await this.uow.transaction(async () => {
        const project = await this.projects.find(input.projectId);
        if (!project) throw NotFound("raqib.project_not_found", "Project not found.");
        if (project.status === "closed") throw Conflict("raqib.project_closed", "This project is closed and takes no new visits.");
        const site = await this.projects.findSite(input.siteId);
        if (!site || site.projectId !== input.projectId) throw ValidationError("raqib.site_mismatch", "The site does not belong to this project.");
        if (input.areaId) {
          const area = await this.projects.findArea(input.areaId);
          if (!area || area.siteId !== input.siteId) throw ValidationError("raqib.area_mismatch", "The area does not belong to this site.");
        }
        if (input.inspectorId) await this.requireEligibleInspector(input.inspectorId, input.projectId, input.date);
        await this.requireScheduleRules({ date: input.date, time: input.time, shift: input.shift }, input.inspectorId);
        const formIds = [...new Set(input.formIds ?? [])];
        for (const fid of formIds) {
          const f = await this.forms.form(fid);
          if (!f || f.category !== "site" || !f.active || !(await this.forms.publishedVersion(fid))) {
            throw ValidationError("raqib.form_not_available", "A chosen form is not an active, published site inspection form.");
          }
        }
        const guardIds = input.guardIds ?? [];
        if (guardIds.length) {
          const known = new Set((await this.projects.guards([input.projectId])).map((g) => g.id));
          if (guardIds.some((g) => !known.has(g))) throw ValidationError("raqib.guard_mismatch", "A guard does not belong to this project.");
        }
        const status = next(null, "schedule", !!input.inspectorId)!;
        const ref = await this.counters.next("VIS", Number(who.today.slice(0, 4)));
        const id = await this.repo.insert({
          ref,
          projectId: input.projectId,
          siteId: input.siteId,
          areaId: input.areaId,
          areaText: input.areaText?.trim() || null,
          inspectorId: input.inspectorId ?? null,
          type: input.type,
          shift: input.shift,
          date: input.date,
          time: input.time,
          status,
          createdBy: who.userId,
        });
        await this.repo.setGuards(id, guardIds);
        await this.repo.setForms(id, formIds);
        const base = { visitId: id, ...actorOf(who) };
        await this.repo.appendEvent({
          ...base,
          action: "scheduled",
          fromStatus: null,
          toStatus: status === "assigned" ? "scheduled" : status,
          reason: input.reason,
        });
        if (status === "assigned")
          await this.repo.appendEvent({
            ...base,
            action: "assigned",
            fromStatus: "scheduled",
            toStatus: "assigned",
            detail: { inspectorId: input.inspectorId },
          });
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.visit.scheduled",
          resourceType: "raqib_visit",
          resourceId: id,
          after: { ref, ...input },
          metadata: { reason: input.reason },
        });
        if (input.inspectorId && input.inspectorId !== who.userId) {
          await this.events.publish(visitAssigned({ visitId: id, inspectorId: input.inspectorId, actorId: who.userId }));
        }
        return (await this.assemble([(await this.repo.find(id))!], who))[0]!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "raqib_visits_inspector_slot_uq"))
        throw Conflict("raqib.inspector_busy", "The inspector already has a visit at that date and time.");
      throw err;
    }
  }

  async reschedule(id: string, input: RescheduleInput, who: Access): Promise<VisitView> {
    requireCan(who, "visits", "A");
    this.requireFuture(input.date, input.time, who.today);
    try {
      return await this.uow.transaction(async () => {
        const v = await this.repo.find(id, true);
        if (!v) throw NotFound("raqib.visit_not_found", "Visit not found.");
        requireProject(who, v.projectId);
        if (!isChangeable(v.status)) throw Conflict("raqib.visit_locked", "This visit can no longer be rescheduled.");
        const inspectorId = input.inspectorId === undefined ? v.inspectorId : input.inspectorId;
        if (inspectorId && inspectorId !== v.inspectorId) await this.requireEligibleInspector(inspectorId, v.projectId, input.date);
        else if (inspectorId) await this.requireEligibleInspector(inspectorId, v.projectId, input.date);
        await this.requireScheduleRules({ date: input.date, time: input.time, shift: v.shift }, inspectorId, v.id);
        const to = next(v.status, "reschedule", !!inspectorId)!;
        await this.repo.update(id, { date: input.date, time: input.time, inspectorId, status: to, overdueNotifiedAt: null });
        const base = { visitId: id, ...actorOf(who) };
        await this.repo.appendEvent({
          ...base,
          action: "rescheduled",
          fromStatus: v.status,
          toStatus: to,
          reason: input.reason,
          detail: { from: { date: v.date, time: v.time, inspectorId: v.inspectorId }, to: { date: input.date, time: input.time, inspectorId } },
        });
        if (to !== v.status && to === "assigned")
          await this.repo.appendEvent({ ...base, action: "assigned", fromStatus: v.status, toStatus: to, detail: { inspectorId } });
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.visit.rescheduled",
          resourceType: "raqib_visit",
          resourceId: id,
          before: { date: v.date, time: v.time, inspectorId: v.inspectorId },
          after: { date: input.date, time: input.time, inspectorId },
          metadata: { reason: input.reason },
        });
        if (v.inspectorId && v.inspectorId !== inspectorId && v.inspectorId !== who.userId) {
          await this.events.publish(visitUnassigned({ visitId: id, previousInspectorId: v.inspectorId, actorId: who.userId }));
        }
        if (inspectorId && inspectorId !== who.userId) {
          const e = inspectorId !== v.inspectorId ? visitAssigned : visitRescheduled;
          await this.events.publish(e({ visitId: id, inspectorId, actorId: who.userId }));
        }
        return (await this.assemble([(await this.repo.find(id))!], who))[0]!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "raqib_visits_inspector_slot_uq"))
        throw Conflict("raqib.inspector_busy", "The inspector already has a visit at that date and time.");
      throw err;
    }
  }

  async cancel(id: string, reason: string, who: Access): Promise<VisitView> {
    requireCan(who, "visits", "A");
    return this.uow.transaction(async () => {
      const v = await this.repo.find(id, true);
      if (!v) throw NotFound("raqib.visit_not_found", "Visit not found.");
      requireProject(who, v.projectId);
      const to = next(v.status, "cancel", !!v.inspectorId);
      if (!to) throw Conflict("raqib.visit_locked", "This visit can no longer be cancelled.");
      await this.repo.update(id, { status: to });
      await this.repo.appendEvent({ visitId: id, ...actorOf(who), action: "cancelled", fromStatus: v.status, toStatus: to, reason });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.visit.cancelled",
        resourceType: "raqib_visit",
        resourceId: id,
        before: { status: v.status },
        after: { status: to },
        metadata: { reason },
      });
      await this.events.publish(visitCancelled({ visitId: id, inspectorId: v.inspectorId, actorId: who.userId, reason }));
      return (await this.assemble([(await this.repo.find(id))!], who))[0]!;
    });
  }

  /** Active site forms with a published version: what a scheduler can require on a visit. */
  async availableForms(who: Access): Promise<Array<{ id: string; code: string; name: L10n; version: string; isDefault: boolean }>> {
    requireCan(who, "visits", "A");
    return readInTenant(async () => {
      const out: Array<{ id: string; code: string; name: L10n; version: string; isDefault: boolean }> = [];
      for (const f of await this.forms.forms()) {
        if (f.category !== "site" || !f.active) continue;
        const v = await this.forms.publishedVersion(f.id);
        if (v) out.push({ id: f.id, code: f.code, name: f.name, version: v.version, isDefault: f.isDefault });
      }
      return out;
    });
  }

  /** The schedule for a period as plain rows (project and inspector filters apply on top of the caller's own scope). */
  private async scheduleRows(who: Access, q: { projectId?: string; from?: string; to?: string; inspectorId?: string }): Promise<ScheduleRow[]> {
    const views = await this.list(who, { projectId: q.projectId, from: q.from, to: q.to });
    const shifts = new Map((await this.shifts()).map((s) => [s.key, s.name]));
    return views
      .filter((v) => (!q.inspectorId || v.inspector?.id === q.inspectorId) && v.storedStatus !== "cancelled")
      .map((v) => ({
        ref: v.ref,
        date: v.date,
        time: v.time,
        project: v.project.name,
        site: v.site.name,
        area: v.area,
        inspector: v.inspector?.name ?? null,
        shift: shifts.get(v.shift) ?? v.shift,
        type: v.type,
        status: v.status,
        forms: v.forms.map((f) => f.code),
      }));
  }

  /** The schedule as a CSV for the period. Needs the export right. */
  async scheduleCsv(who: Access, q: { projectId?: string; from?: string; to?: string; inspectorId?: string }, lang: "ar" | "en"): Promise<string> {
    requireCan(who, "visits", "X");
    return readInTenant(async () => scheduleCsv(await this.scheduleRows(who, q), lang, csvField));
  }

  /** The schedule as a print-ready A4 page for the period, grouped by inspector. Needs the download right. */
  async schedulePrint(who: Access, q: { projectId?: string; from?: string; to?: string; inspectorId?: string }, lang: "ar" | "en"): Promise<string> {
    requireCan(who, "visits", "D");
    return readInTenant(async () => {
      const rows = await this.scheduleRows(who, q);
      const brand = await this.branding.current();
      return renderScheduleHtml(rows, { from: q.from ?? "…", to: q.to ?? "…" }, lang, brand.name[lang], brand.logo);
    });
  }

  async shifts(): Promise<Array<{ key: string; name: L10n; start: string; end: string }>> {
    const { schedule } = await this.settings.current();
    return schedule.shifts.map((s) => ({ key: s.key, name: { ar: s.nameAr, en: s.nameEn }, start: s.start, end: s.end }));
  }

  /** Active inspectors assigned to the project on `date` - who a visit in that project can be given to. */
  async eligibleInspectors(projectId: string, date: string, who: Access): Promise<Array<{ id: string; name: L10n; ini: L10n }>> {
    requireCan(who, "visits", "A");
    requireProject(who, projectId);
    return readInTenant(async () => {
      const out: Array<{ id: string; name: L10n; ini: L10n }> = [];
      for (const p of await this.people.list()) {
        if (p.roleKey !== "ins" || p.status !== "active") continue;
        if (!(await this.people.activeProjectIds(p.userId, date)).includes(projectId)) continue;
        out.push({ id: p.userId, name: { ar: p.nameAr, en: p.nameEn }, ini: { ar: initials(p.nameAr), en: initials(p.nameEn) } });
      }
      return out;
    });
  }

  /** The week [from, from+6] for the calendar (same visibility rules as `list`). */
  calendar(who: Access, from: string): Promise<VisitView[]> {
    return this.list(who, { from, to: addDays(from, 6) });
  }
}
