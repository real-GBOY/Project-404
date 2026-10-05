import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { DomainEvent } from "@core/contracts/domain-event.js";
import type { INotificationProvider, IUserProvider } from "@core/contracts/index.js";
import { EventRegistry } from "@core/events/registry.js";
import { NOTIFICATION_PROVIDER, USER_PROVIDER } from "@core/kernel/tokens.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { ActionsRepository, type ActionRecord } from "@raqib/raqib/actions/infrastructure/actions-repository.js";
import { TrainingRepository, type TrainingRecord } from "@raqib/raqib/training/infrastructure/training-repository.js";
import { VisitsRepository, type VisitRecord } from "@raqib/raqib/visits/infrastructure/visits-repository.js";

type Lang = "ar" | "en";
type Payload = Record<string, unknown>;

/** "5 Oct · 14:00" / Arabic month name — Western digits in both languages. */
function when(date: string, time: string, lang: Lang): string {
  const d = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00`));
  return `${d} · ${time}`;
}

/**
 * Who hears about what. Each rule reacts to a domain event IN-PROCESS — inside the transaction that caused it —
 * and writes in-app notifications through Core's provider, so a notification exists exactly when its cause
 * committed. Recipients are chosen by live permission + project scope (never by role name) and nobody is notified
 * about their own action. Text is rendered per recipient language. Nothing here ever carries confidential content.
 *
 *   raqib.visit_assigned     → the inspector
 *   raqib.visit_rescheduled  → the inspector
 *   raqib.visit_unassigned   → the previous inspector
 *   raqib.visit_cancelled    → the inspector
 *   raqib.visit_overdue      → the inspector and everyone who schedules visits for that project
 */
@Injectable()
export class RaqibNotifications implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    @Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    private readonly visits: VisitsRepository,
    private readonly actions: ActionsRepository,
    private readonly training: TrainingRepository,
    private readonly projects: ProjectsRepository,
    private readonly access: AccessService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    const on = (name: string, h: (p: Payload) => Promise<void>) => this.registry.onInProcess(name, (e: DomainEvent) => h(e.payload as Payload));
    on("raqib.visit_assigned", (p) => this.visitTo("raqib.visit_assigned", p, String(p.inspectorId)));
    on("raqib.visit_rescheduled", (p) => this.visitTo("raqib.visit_rescheduled", p, String(p.inspectorId)));
    on("raqib.visit_unassigned", (p) => this.visitTo("raqib.visit_unassigned", p, String(p.previousInspectorId)));
    on("raqib.visit_cancelled", (p) => (p.inspectorId ? this.visitTo("raqib.visit_cancelled", p, String(p.inspectorId)) : Promise.resolve()));
    on("raqib.visit_overdue", (p) => this.overdue(p));
    on("raqib.inspection_submitted", (p) => this.submitted(p));
    on("raqib.inspection_forwarded", (p) => this.forwarded(p));
    on("raqib.inspection_returned", (p) => this.toInspector(p, "raqib.inspection_returned", ["inspect", String(p.visitId)]));
    on("raqib.inspection_rejected", (p) => this.toInspector(p, "raqib.inspection_rejected", ["visit", String(p.visitId)]));
    on("raqib.inspection_approved", (p) => this.approved(p));
    on("raqib.action_assigned", (p) => this.action(p, "raqib.action_assigned", async () => []));
    on("raqib.action_submitted", (p) => this.action(p, "raqib.action_submitted", (a, today) => this.access.holders("actions", "R", a.projectId, today, String(p.actorId)), false));
    on("raqib.action_returned", (p) => this.action(p, "raqib.action_returned", async () => []));
    on("raqib.action_closed", (p) => this.action(p, "raqib.action_closed", async (a) => (a.createdBy ? [a.createdBy] : [])));
    on("raqib.training_requested", (p) => this.trainingTo(p, "raqib.training_requested", (t, today) => this.access.holders("training", "P", t.projectId, today, String(p.actorId))));
    on("raqib.training_approved", (p) => this.trainingTo(p, "raqib.training_approved", async (t, today) => [...(t.requestedBy ? [t.requestedBy] : []), ...(await this.access.holders("training", "R", t.projectId, today, String(p.actorId)))]));
    on("raqib.training_decided", (p) => this.trainingTo(p, p.decision === "rejected" ? "raqib.training_rejected" : "raqib.training_returned", async (t) => (t.requestedBy ? [t.requestedBy] : [])));
    on("raqib.training_scheduled", (p) => this.trainingTo(p, "raqib.training_scheduled", async (t) => (t.requestedBy ? [t.requestedBy] : [])));
    on("raqib.training_completed", (p) => this.trainingTo(p, "raqib.training_completed", async (t) => (t.requestedBy ? [t.requestedBy] : [])));
    on("raqib.action_overdue", (p) => this.action(p, "raqib.action_overdue", (a, today) => this.access.holders("actions", "R", a.projectId, today), true));
  }

  private async lang(userId: string): Promise<Lang> {
    const u = await this.users.getUser(userId);
    return u?.locale === "en" ? "en" : "ar";
  }

  private async send(userId: string, key: string, v: VisitRecord, extra: Record<string, string> = {}, go: [string, string] = ["visit", v.id]): Promise<void> {
    const lang = await this.lang(userId);
    const site = await this.projects.findSite(v.siteId);
    await this.notify.send({
      userId,
      templateKey: key,
      type: key,
      locale: lang,
      data: { ref: v.ref, site: site ? site.name[lang] : "", when: when(v.date, v.time, lang), ...extra, go },
    });
  }

  private async visitTo(key: string, p: Payload, recipient: string): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v || recipient === p.actorId) return;
    await this.send(recipient, key, v, key === "raqib.visit_cancelled" ? { reason: String(p.reason ?? "") } : {});
  }

  private async actorName(p: Payload, lang: Lang): Promise<string> {
    const a = await this.access.profileOf(String(p.actorId));
    return a ? (lang === "ar" ? a.nameAr : a.nameEn) : "";
  }

  /** Forwarded for approval: everyone who can approve in that project (never the forwarder). */
  private async forwarded(p: Payload): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v) return;
    const approvers = await this.access.holders("inspections", "P", v.projectId, await this.settings.today(), String(p.actorId));
    for (const r of approvers) await this.send(r, "raqib.inspection_forwarded", v, { actor: await this.actorName(p, await this.lang(r)) }, ["review", v.id]);
  }

  /** A decision that concerns the inspector who did the work: returned (with the reason) or rejected. */
  private async toInspector(p: Payload, key: string, go: [string, string]): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v?.inspectorId || v.inspectorId === p.actorId) return;
    await this.send(v.inspectorId, key, v, { reason: String(p.reason ?? ""), actor: await this.actorName(p, await this.lang(v.inspectorId)) }, go);
  }

  /** Approved: the inspector and the managers who follow that project. */
  private async approved(p: Payload): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v) return;
    const today = await this.settings.today();
    const to = new Set<string>(await this.access.holders("reports", "V", v.projectId, today, String(p.actorId)));
    if (v.inspectorId && v.inspectorId !== p.actorId) to.add(v.inspectorId);
    for (const r of to) await this.send(r, "raqib.inspection_approved", v, { actor: await this.actorName(p, await this.lang(r)) }, r === v.inspectorId ? ["visit", v.id] : ["visit", v.id]);
  }

  /** A submitted inspection goes to everyone who can review in that project (never the submitter). */
  private async submitted(p: Payload): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v) return;
    const today = await this.settings.today();
    const reviewers = await this.access.holders("inspections", "R", v.projectId, today, String(p.actorId));
    const actor = (await this.access.profileOf(String(p.actorId)));
    for (const r of reviewers) {
      const lang = await this.lang(r);
      await this.send(r, p.resubmission ? "raqib.inspection_resubmitted" : "raqib.inspection_submitted", v, { actor: actor ? (lang === "ar" ? actor.nameAr : actor.nameEn) : "" }, ["review", v.id]);
    }
  }

  private async overdue(p: Payload): Promise<void> {
    const v = await this.visits.find(String(p.visitId));
    if (!v) return;
    const today = await this.settings.today();
    const recipients = new Set<string>(await this.access.holders("visits", "A", v.projectId, today));
    if (v.inspectorId) recipients.add(v.inspectorId);
    for (const r of recipients) await this.send(r, "raqib.visit_overdue", v);
  }

  /**
   * Corrective-action notifications. `extra` adds recipients beyond the responsible person; `includeResponsible`
   * says whether the responsible person hears about it (not when they themselves just handed the work over).
   */
  private async action(p: Payload, key: string, extra: (a: ActionRecord, today: string) => Promise<string[]>, includeResponsible = true): Promise<void> {
    const a = await this.actions.find(String(p.actionId));
    if (!a) return;
    const today = await this.settings.today();
    const to = new Set<string>(await extra(a, today));
    if (includeResponsible) to.add(a.responsibleId);
    if (p.actorId) to.delete(String(p.actorId));
    for (const r of to) {
      const lang = await this.lang(r);
      await this.notify.send({
        userId: r,
        templateKey: key,
        type: key,
        locale: lang,
        data: { ref: a.ref, title: a.title[lang], due: a.dueDate, reason: String(p.reason ?? ""), actor: p.actorId ? await this.actorName(p, lang) : "", go: ["action", a.id] },
      });
    }
  }

  private async trainingTo(p: Payload, key: string, who: (t: TrainingRecord, today: string) => Promise<string[]>): Promise<void> {
    const t = await this.training.find(String(p.requestId));
    if (!t) return;
    const guard = await this.projects.findGuard(t.guardId);
    const to = new Set(await who(t, await this.settings.today()));
    if (p.actorId) to.delete(String(p.actorId));
    for (const r of to) {
      const lang = await this.lang(r);
      await this.notify.send({
        userId: r, templateKey: key, type: key, locale: lang,
        data: { ref: t.ref, course: t.course, guard: guard ? guard.name[lang] : "", reason: String(p.reason ?? ""), date: t.scheduledDate ?? "", go: ["trainingD", t.id] },
      });
    }
  }
}
