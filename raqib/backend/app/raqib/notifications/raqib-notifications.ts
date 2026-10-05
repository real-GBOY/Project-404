import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { DomainEvent } from "@core/contracts/domain-event.js";
import type { INotificationProvider, IUserProvider } from "@core/contracts/index.js";
import { EventRegistry } from "@core/events/registry.js";
import { NOTIFICATION_PROVIDER, USER_PROVIDER } from "@core/kernel/tokens.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
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
}
