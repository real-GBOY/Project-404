import { Inject, Injectable } from "@nestjs/common";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { UploadGuard } from "@raqib/raqib/shared/upload-guard.js";
import { CLOCK, FILE_STORAGE, NOTIFICATION_PROVIDER, USER_PROVIDER } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IFileStorage, INotificationProvider, IUserProvider } from "@core/contracts/index.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { evidenceKind } from "@raqib/raqib/evidence/application/evidence-service.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import {
  ConfRepository,
  confidentially,
  type ConfGrantRecord,
  type ConfKind,
  type ConfReportRecord,
  type ConfStatus,
  type GrantLevel,
  type GrantScope,
  type IdentityMode,
  type Sensitivity,
} from "../infrastructure/conf-repository.js";

/** How long an entry (with its stated reason) keeps the area open before the person must enter again. */
export const SESSION_MINUTES = 30;
const MAX_GRANT_DAYS = 365;
const MIN_GRANT_HOURS = 1;
const ENTRY_REASONS = ["investigation", "follow_up", "audit", "grant_review"] as const;

const SENSITIVITY: Record<ConfKind, Sensitivity> = { misconduct: "high", violation: "standard", safety: "standard" };

export interface SubmitInput {
  kind: ConfKind;
  subject: string;
  body: string;
  place: string;
  identity: IdentityMode;
  fileIds: string[];
}

export interface ConfAccessView {
  isGM: boolean;
  grant: { id: string; level: GrantLevel; scope: GrantScope; expiresAt: string } | null;
  sessionUntil: string | null;
  reasons: string[];
}

export interface ConfReportView {
  id: string;
  ref: string;
  kind: ConfKind;
  sensitivity: Sensitivity;
  subject: string;
  place: string;
  status: ConfStatus;
  at: string;
  /** Detail only. */
  body?: string;
  files?: Array<{ id: string; name: string; mime: string; sizeBytes: number }>;
  response?: string | null;
  identity?: { mode: IdentityMode; revealed: boolean; name?: L10n; employeeNo?: string };
  canRespond?: boolean;
}

export interface MineView {
  ref: string;
  kind: ConfKind;
  subject: string;
  status: ConfStatus;
  at: string;
  response: string | null;
}

export interface GrantView {
  id: string;
  user: { id: string; name: L10n; role: string };
  level: GrantLevel;
  scope: GrantScope;
  reason: string;
  grantedBy: L10n;
  grantedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
  revokedBy: L10n | null;
  revokeReason: string | null;
}

/**
 * The confidential area. Access is never derived from a role: an officer needs an active, GM-issued grant AND an
 * open session (an entry with a stated reason, logged); the GM manages grants but reads no report unless they hold
 * a grant too, and cannot grant themselves one. Every step is written to the protected log, and the reporter's
 * identity lives apart from the report and only opens through a reveal with a reason.
 */
@Injectable()
export class ConfidentialService {
  constructor(
    private readonly repo: ConfRepository,
    private readonly access: AccessRepository,
    private readonly counters: Counters,
    private readonly projects: ProjectsRepository,
    private readonly settings: SettingsService,
    private readonly guard: UploadGuard,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private nameOf = (who: Access): L10n => ({ ar: who.nameAr, en: who.nameEn });

  // ── anyone: report and follow up on your own reports ──────────────────

  async submit(input: SubmitInput, who: Access): Promise<{ id: string | null; ref: string }> {
    if (input.fileIds.length > 5) throw ValidationError("raqib.too_many_files", "Attach at most five files.");
    const afterCommits: Array<() => Promise<void>> = [];
    const result = await confidentially(async () => {
      const now = this.clock.now();
      const ref = await this.counters.next("CNF", now.getUTCFullYear());
      const id = await this.repo.insertReport({
        ref,
        kind: input.kind,
        sensitivity: SENSITIVITY[input.kind],
        subject: input.subject,
        body: input.body,
        place: input.place,
        identityMode: input.identity,
      });
      if (input.identity !== "anonymous") {
        const guard = (await this.projects.guards()).find((g) => g.userId === who.userId);
        await this.repo.insertIdentity(id, { userId: who.userId, name: this.nameOf(who), employeeNo: guard?.employeeNo ?? "" });
      }
      const s = await this.settings.current();
      for (const fileId of input.fileIds) {
        const file = await this.files.describe(fileId).catch(() => null);
        if (!file) throw NotFound("raqib.file_not_found", "File not found.");
        if (file.status !== "stored") throw Conflict("raqib.file_not_stored", "The upload has not finished.");
        if (file.ownerId !== who.userId) throw Forbidden("raqib.file_not_yours", "You can only attach files you uploaded.");
        const kind = evidenceKind(file.contentType);
        if (!kind) throw ValidationError("raqib.file_type_not_allowed", "Only photos, videos and PDF documents can be attached.");
        const limitMb = kind === "video" ? s.attach.video : kind === "doc" ? s.attach.doc : s.attach.photo;
        if (file.byteSize > limitMb * 1_048_576) throw ValidationError("raqib.file_too_large", `This file exceeds the ${limitMb} MB limit.`, { limitMb });
        const admitted = await this.guard.admit(file, kind, who.userId);
        afterCommits.push(admitted.afterCommit);
        await this.repo.insertFile(id, {
          fileId: admitted.file.id,
          name: admitted.file.originalName,
          mime: admitted.file.contentType,
          sizeBytes: admitted.file.byteSize,
        });
      }
      // the log never names the reporter: confidential and anonymous reports must stay that way
      await this.repo.log({ at: this.clock.now(), action: "submit", actorId: null, actor: { ar: "مُبلِّغ", en: "Reporter" }, reportRef: ref });
      await this.announce(ref, now);
      return { id: input.identity === "anonymous" ? null : id, ref };
    });
    for (const done of afterCommits) await done();
    return result;
  }

  async mine(who: Access): Promise<MineView[]> {
    return confidentially(async () =>
      (await this.repo.mine(who.userId)).map((r) => ({
        ref: r.ref,
        kind: r.kind,
        subject: r.subject,
        status: r.status,
        at: r.createdAt.toISOString(),
        response: r.response,
      })),
    );
  }

  // ── access: grant + session ───────────────────────────────────────────

  async accessOf(who: Access): Promise<ConfAccessView> {
    return confidentially(async () => {
      const now = this.clock.now();
      const grant = await this.repo.activeGrant(who.userId, now);
      return {
        isGM: who.role === "gm",
        grant: grant ? { id: grant.id, level: grant.level, scope: grant.scope, expiresAt: grant.expiresAt.toISOString() } : null,
        sessionUntil: (await this.sessionUntil(who.userId, now))?.toISOString() ?? null,
        reasons: [...ENTRY_REASONS],
      };
    });
  }

  /** Enter the area: needs an active grant (or the GM role, for grant management), a reason, and an acknowledgement. */
  async enter(reason: string, ack: boolean, device: string | null, who: Access): Promise<{ until: string }> {
    if (!ENTRY_REASONS.includes(reason as never)) throw ValidationError("raqib.reason_required", "Choose why you are entering.");
    if (!ack) throw ValidationError("raqib.ack_required", "Acknowledge the confidentiality terms.");
    return confidentially(async () => {
      const now = this.clock.now();
      const grant = await this.repo.activeGrant(who.userId, now);
      if (!grant && who.role !== "gm") throw Forbidden("raqib.conf_no_grant", "You have no active grant for this area.");
      await this.repo.log({ at: this.clock.now(), action: "enter", actorId: who.userId, actor: this.nameOf(who), reason, device });
      return { until: new Date(now.getTime() + SESSION_MINUTES * 60_000).toISOString() };
    });
  }

  async exit(device: string | null, who: Access): Promise<void> {
    await confidentially(() => this.repo.log({ at: this.clock.now(), action: "exit", actorId: who.userId, actor: this.nameOf(who), device }));
  }

  private async sessionUntil(userId: string, now: Date): Promise<Date | null> {
    const last = await this.repo.lastSessionEvent(userId);
    if (!last || last.action !== "enter") return null;
    const until = new Date(last.at.getTime() + SESSION_MINUTES * 60_000);
    return until > now ? until : null;
  }

  private async requireOfficer(who: Access, level: GrantLevel): Promise<ConfGrantRecord> {
    const now = this.clock.now();
    const grant = await this.repo.activeGrant(who.userId, now);
    if (!grant) throw Forbidden("raqib.conf_no_grant", "You have no active grant for this area.");
    if (level === "respond" && grant.level !== "respond") throw Forbidden("raqib.conf_view_only", "Your grant allows viewing only.");
    if (!(await this.sessionUntil(who.userId, now))) throw Forbidden("raqib.conf_session_required", "Enter the area again with a reason.");
    return grant;
  }

  private async requireGM(who: Access): Promise<void> {
    if (who.role !== "gm") throw Forbidden("raqib.conf_gm_only", "Only the General Manager can do this.");
    if (!(await this.sessionUntil(who.userId, this.clock.now()))) throw Forbidden("raqib.conf_session_required", "Enter the area again with a reason.");
  }

  // ── officers: read and respond ────────────────────────────────────────

  async list(device: string | null, who: Access): Promise<ConfReportView[]> {
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "view");
      await this.repo.log({ at: this.clock.now(), action: "view_list", actorId: who.userId, actor: this.nameOf(who), device });
      return (await this.repo.list(grant.scope)).map((r) => this.summary(r));
    });
  }

  async get(id: string, device: string | null, who: Access): Promise<ConfReportView> {
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "view");
      const r = await this.readable(id, grant);
      await this.repo.log({ at: this.clock.now(), action: "view_report", actorId: who.userId, actor: this.nameOf(who), reportRef: r.ref, device });
      return this.detail(r, grant, who);
    });
  }

  async respond(id: string, text: string, status: ConfStatus | undefined, device: string | null, who: Access): Promise<ConfReportView> {
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "respond");
      const r = await this.readable(id, grant, true);
      await this.repo.update(r.id, { response: text, status: status ?? (r.status === "new" ? "under_review" : r.status) });
      await this.repo.log({ at: this.clock.now(), action: "respond", actorId: who.userId, actor: this.nameOf(who), reportRef: r.ref, device });
      const identity = r.identityMode === "anonymous" ? null : await this.repo.identity(r.id);
      // the reporter is told a response exists — never what it says
      if (identity) await this.tell(identity.userId, "raqib.conf_response", r.ref);
      return this.detail((await this.repo.find(r.id))!, grant, who);
    });
  }

  async setStatus(id: string, status: ConfStatus, device: string | null, who: Access): Promise<ConfReportView> {
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "respond");
      const r = await this.readable(id, grant, true);
      await this.repo.update(r.id, { status });
      await this.repo.log({ at: this.clock.now(), action: "status", actorId: who.userId, actor: this.nameOf(who), reportRef: r.ref, reason: status, device });
      return this.detail((await this.repo.find(r.id))!, grant, who);
    });
  }

  /** Open a confidential reporter's identity. Needs the respond level and a reason; always logged. */
  async reveal(id: string, reason: string, device: string | null, who: Access): Promise<ConfReportView> {
    if (reason.trim().length < 3) throw ValidationError("raqib.reason_required", "A reason is required to reveal an identity.");
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "respond");
      const r = await this.readable(id, grant);
      if (r.identityMode === "anonymous") throw Conflict("raqib.anonymous", "This report is anonymous: there is no identity to reveal.");
      await this.repo.log({
        at: this.clock.now(),
        action: "reveal_identity",
        actorId: who.userId,
        actor: this.nameOf(who),
        reportRef: r.ref,
        reason: reason.trim(),
        device,
      });
      return this.detail(r, grant, who);
    });
  }

  async fileContent(id: string, fileRowId: string, device: string | null, who: Access): Promise<{ content: Buffer; name: string; mime: string }> {
    return confidentially(async () => {
      const grant = await this.requireOfficer(who, "view");
      const r = await this.readable(id, grant);
      const f = await this.repo.file(r.id, fileRowId);
      if (!f) throw NotFound("raqib.file_not_found", "File not found.");
      const { content } = await this.files.getContent({ id: f.fileId });
      await this.repo.log({ at: this.clock.now(), action: "open_file", actorId: who.userId, actor: this.nameOf(who), reportRef: r.ref, device });
      return { content, name: f.name, mime: f.mime };
    });
  }

  // ── the General Manager: grants and the protected log ─────────────────

  async grants(who: Access): Promise<GrantView[]> {
    return confidentially(async () => {
      await this.requireGM(who);
      const profiles = new Map((await this.access.allProfiles()).map((p) => [p.userId, p]));
      const now = this.clock.now();
      return (await this.repo.grants()).map((g) => ({
        id: g.id,
        user: {
          id: g.userId,
          name: { ar: profiles.get(g.userId)?.nameAr ?? "—", en: profiles.get(g.userId)?.nameEn ?? "—" },
          role: profiles.get(g.userId)?.roleKey ?? "",
        },
        level: g.level,
        scope: g.scope,
        reason: g.reason,
        grantedBy: g.grantedBy,
        grantedAt: g.grantedAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
        status: g.revokedAt ? "revoked" : g.expiresAt <= now ? "expired" : "active",
        revokedBy: g.revokedBy,
        revokeReason: g.revokeReason,
      }));
    });
  }

  async grantees(who: Access): Promise<Array<{ id: string; name: L10n; role: string }>> {
    return confidentially(async () => {
      await this.requireGM(who);
      return (await this.access.allProfiles())
        .filter((p) => p.status === "active" && p.userId !== who.userId && p.roleKey !== "guard")
        .map((p) => ({ id: p.userId, name: { ar: p.nameAr, en: p.nameEn }, role: p.roleKey }));
    });
  }

  async issueGrant(input: { userId: string; level: GrantLevel; scope: GrantScope; reason: string; expiresAt: string }, who: Access): Promise<void> {
    if (input.reason.trim().length < 3) throw ValidationError("raqib.reason_required", "A reason is required to issue a grant.");
    await confidentially(async () => {
      await this.requireGM(who);
      if (input.userId === who.userId) throw Forbidden("raqib.conf_self_grant", "You cannot grant yourself access to reports.");
      const target = await this.access.profile(input.userId);
      if (!target || target.status !== "active") throw ValidationError("raqib.invalid_grantee", "Choose an active person.");
      const now = this.clock.now();
      const expiresAt = new Date(input.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime() + MIN_GRANT_HOURS * 3_600_000)
        throw ValidationError("raqib.invalid_expiry", "A grant must last at least an hour.");
      if (expiresAt.getTime() > now.getTime() + MAX_GRANT_DAYS * 86_400_000)
        throw ValidationError("raqib.invalid_expiry", "A grant cannot last more than a year.");
      await this.repo.insertGrant({
        userId: input.userId,
        level: input.level,
        scope: input.scope,
        reason: input.reason.trim(),
        grantedBy: who.userId,
        grantedByName: this.nameOf(who),
        expiresAt,
      });
      await this.repo.log({
        at: this.clock.now(),
        action: "grant_issued",
        actorId: who.userId,
        actor: this.nameOf(who),
        reason: `${target.nameEn}: ${input.level}/${input.scope} — ${input.reason.trim()}`,
      });
    });
  }

  async revokeGrant(id: string, reason: string, who: Access): Promise<void> {
    if (reason.trim().length < 3) throw ValidationError("raqib.reason_required", "A reason is required to revoke a grant.");
    await confidentially(async () => {
      await this.requireGM(who);
      const g = await this.repo.findGrant(id, true);
      if (!g) throw NotFound("raqib.grant_not_found", "Grant not found.");
      if (g.revokedAt) throw Conflict("raqib.grant_revoked", "This grant is already revoked.");
      await this.repo.revokeGrant(id, { userId: who.userId, name: this.nameOf(who) }, reason.trim());
      await this.repo.log({ at: this.clock.now(), action: "grant_revoked", actorId: who.userId, actor: this.nameOf(who), reason: reason.trim() });
    });
  }

  async log(
    who: Access,
  ): Promise<Array<{ id: string; action: string; actor: L10n; reportRef: string | null; reason: string | null; device: string | null; at: string }>> {
    return confidentially(async () => {
      await this.requireGM(who);
      return (await this.repo.recentLog(200)).map((e) => ({
        id: e.id,
        action: e.action,
        actor: e.actor,
        reportRef: e.reportRef,
        reason: e.reason,
        device: e.device,
        at: e.at.toISOString(),
      }));
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private summary(r: ConfReportRecord): ConfReportView {
    return {
      id: r.id,
      ref: r.ref,
      kind: r.kind,
      sensitivity: r.sensitivity,
      subject: r.subject,
      place: r.place,
      status: r.status,
      at: r.createdAt.toISOString(),
    };
  }

  private async readable(id: string, grant: ConfGrantRecord, lock = false): Promise<ConfReportRecord> {
    const r = await this.repo.find(id, lock);
    if (!r || (grant.scope === "standard" && r.sensitivity === "high")) throw NotFound("raqib.conf_report_not_found", "Report not found.");
    return r;
  }

  private async detail(r: ConfReportRecord, grant: ConfGrantRecord, who: Access): Promise<ConfReportView> {
    const identity = r.identityMode === "anonymous" ? null : await this.repo.identity(r.id);
    const revealed = r.identityMode === "named" || (await this.repo.revealedBy(who.userId, r.ref));
    return {
      ...this.summary(r),
      body: r.body,
      files: (await this.repo.files(r.id)).map((f) => ({ id: f.id, name: f.name, mime: f.mime, sizeBytes: f.sizeBytes })),
      response: r.response,
      canRespond: grant.level === "respond",
      identity: {
        mode: r.identityMode,
        revealed: !!identity && revealed,
        ...(identity && revealed ? { name: identity.name, employeeNo: identity.employeeNo } : {}),
      },
    };
  }

  /** Tell the grant holders a report arrived: its reference only. */
  private async announce(ref: string, now: Date): Promise<void> {
    for (const userId of await this.repo.activeGrantHolders(now)) await this.tell(userId, "raqib.conf_new", ref);
  }

  private async tell(userId: string, key: string, ref: string): Promise<void> {
    const u = await this.users.getUser(userId);
    const locale = u?.locale === "en" ? "en" : "ar";
    await this.notify.send({ userId, templateKey: key, type: key, locale, data: { ref, go: ["confidential", ""] } });
  }
}
