import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { AppError, Forbidden, NotFound, Unauthenticated, ValidationError } from "@core/kernel/errors.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import { DEFAULT_SETTINGS, type OrgSettings } from "@raqib/raqib/settings/domain/defaults.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { open, seal } from "@raqib/raqib/shared/data-key.js";
import { accountPolicyEnforced, readRaqibConfig } from "@raqib/config.js";
import { newRecoveryCodes, newSecret, otpauthUri, verifyTotp } from "../domain/totp.js";
import { AccountRepository, type SecurityRow } from "../infrastructure/account-repository.js";

const FAILURE_WINDOW_MS = 15 * 60_000;
const DAY = 86_400_000;
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** What an organization's security settings mean for one person. */
export interface AccountPolicy {
  /** Wrong passwords tolerated inside the window before the account locks (0 = no lock-out). */
  lockout: number;
  mfaRequired: boolean;
  minPasswordLength: number;
  /** Days before a password must be replaced (0 = never). */
  rotateDays: number;
  /** Minutes of inactivity before the web app signs the person out. */
  sessionMinutes: number;
}

export interface SecurityStatus {
  mfa: { enabled: boolean; pending: boolean; required: boolean; recoveryLeft: number };
  password: { changedAt: string | null; expired: boolean; minLength: number; rotateDays: number };
  sessionMinutes: number;
  /** Set when the organization's rules force the person to act before using anything else. */
  setupRequired: Array<"mfa" | "password">;
}

export const mfaRequiredFor = (s: OrgSettings, role: string): boolean =>
  s.security.mfa
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .includes(role);

export const policyOf = (s: OrgSettings, role: string | null): AccountPolicy => ({
  lockout: s.security.lockout,
  mfaRequired: role ? mfaRequiredFor(s, role) : false,
  minPasswordLength: s.security.pwLen,
  rotateDays: s.security.pwRotate,
  sessionMinutes: s.security.session,
});

export const passwordExpired = (sec: SecurityRow | null, rotateDays: number, now: Date): boolean =>
  rotateDays > 0 && !!sec?.passwordChangedAt && now.getTime() - sec.passwordChangedAt.getTime() > rotateDays * DAY;

@Injectable()
export class AccountService {
  constructor(
    private readonly repo: AccountRepository,
    private readonly settings: SettingsRepository,
    private readonly profiles: AccessRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  private sys<T>(fn: () => Promise<T>): Promise<T> {
    return runAsSystem(() => this.uow.transaction(fn));
  }

  /** The organization's settings and the person's role there, read as that organization (system role, explicit tenant). */
  private async policyFor(userId: string, organizationId: string | null): Promise<{ settings: OrgSettings; role: string | null }> {
    if (!organizationId) return { settings: DEFAULT_SETTINGS, role: null };
    return withContext({ userId, organizationId }, () =>
      this.uow.transaction(async () => ({
        settings: await this.settings.load(),
        role: (await this.profiles.profile(userId))?.roleKey ?? null,
      })),
    );
  }

  // ── sign-in protection (called by the login interceptor) ──────────────

  /** Refuse a locked address before any password is checked (the answer is the same whether or not the account exists). */
  async assertNotLocked(email: string): Promise<void> {
    const t = await this.sys(() => this.repo.throttle(email));
    if (t?.lockedUntil && t.lockedUntil > this.clock.now()) {
      const retryAfterSec = Math.max(1, Math.ceil((t.lockedUntil.getTime() - this.clock.now().getTime()) / 1000));
      throw new AppError({
        code: "raqib.account_locked",
        message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s) or reset your password.`,
        kind: "rate_limited",
        details: { retryAfterSec },
      });
    }
  }

  /**
   * Second-factor gate. Only a person who enabled a second factor is challenged, and only after the password is right
   * (so the challenge itself does not tell a stranger which e-mails exist). Wrong codes count like wrong passwords.
   */
  async requireSecondFactor(email: string, password: unknown, otp: unknown): Promise<void> {
    if (typeof password !== "string" || !password) return;
    const user = await this.sys(() => this.repo.loginUser(email));
    if (!user) return;
    const sec = await this.sys(() => this.repo.security(user.id));
    if (!sec?.mfaEnabledAt || !sec.mfaSecret) return;
    if (!(await argon2Hasher.verify(user.passwordHash, password))) return; // the normal path rejects (and counts) it
    if (typeof otp !== "string" || !otp.trim()) throw Unauthenticated("raqib.mfa_required", "Enter the code from your authenticator app.");
    const now = this.clock.now();
    const step = verifyTotp(open(sec.mfaSecret), otp, now, sec.mfaLastStep);
    if (step !== null) {
      await this.sys(() => this.repo.useStep(user.id, step, now));
      return;
    }
    const hash = sha(otp.trim().toLowerCase());
    if (sec.mfaRecovery.includes(hash)) {
      await this.sys(async () => {
        await this.repo.setRecovery(
          user.id,
          sec.mfaRecovery.filter((h) => h !== hash),
          now,
        );
        await this.audit.record({ actorId: user.id, action: "raqib.mfa.recovery_code_used", resourceType: "user", resourceId: user.id });
      });
      return;
    }
    await this.recordFailure(email);
    throw Unauthenticated("raqib.mfa_invalid", "That code is not valid.");
  }

  async recordFailure(email: string): Promise<void> {
    const user = await this.sys(() => this.repo.loginUser(email));
    const { settings } = user ? await this.policyFor(user.id, user.organizationId) : { settings: DEFAULT_SETTINGS };
    const max = settings.security.lockout;
    if (max <= 0) return;
    const now = this.clock.now();
    const lockUntil = new Date(now.getTime() + readRaqibConfig().lockoutMinutes * 60_000);
    const t = await this.sys(() => this.repo.recordFailure(email, now, new Date(now.getTime() - FAILURE_WINDOW_MS), max, lockUntil));
    if (t.lockedUntil && t.failures === max) {
      await this.sys(() =>
        this.audit.record({
          actorId: user?.id ?? null,
          action: "raqib.account.locked",
          resourceType: "user",
          resourceId: user?.id ?? "unknown",
          metadata: { failures: t.failures, until: t.lockedUntil!.toISOString() },
        }),
      );
    }
  }

  async recordSuccess(email: string): Promise<void> {
    await this.sys(() => this.repo.clearThrottle(email));
  }

  // ── password policy ───────────────────────────────────────────────────

  /** Reject a new password shorter than the organization requires (Core already enforces its own floor of 10). */
  async assertPasswordMeetsPolicy(password: unknown, organizationId: string | null, userId: string): Promise<void> {
    if (typeof password !== "string") return;
    const { settings } = await this.policyFor(userId, organizationId);
    const min = settings.security.pwLen;
    if (password.length < min) throw ValidationError("raqib.password_too_short", `The password must be at least ${min} characters.`, { minLength: min });
  }

  async resetTokenOwner(tokenHash: string) {
    return this.sys(() => this.repo.resetTokenOwner(tokenHash, this.clock.now()));
  }

  async markPasswordChanged(userId: string): Promise<void> {
    await this.sys(() => this.repo.stampPassword(userId, this.clock.now()));
  }

  async changePassword(who: Access, current: string, next: string): Promise<void> {
    const hash = await this.sys(() => this.repo.userPasswordHash(who.userId));
    if (!hash || !(await argon2Hasher.verify(hash, current))) throw Unauthenticated("raqib.wrong_password", "The current password is not correct.");
    if (next === current) throw ValidationError("raqib.password_unchanged", "Choose a password different from the current one.");
    await this.assertPasswordMeetsPolicy(next, who.organizationId, who.userId);
    const newHash = await argon2Hasher.hash(next);
    const now = this.clock.now();
    await this.sys(async () => {
      await this.repo.setPasswordHash(who.userId, newHash, now);
      await this.repo.stampPassword(who.userId, now);
      await this.repo.revokeSessions(who.userId, now);
      await this.audit.record({ actorId: who.userId, action: "raqib.password.changed", resourceType: "user", resourceId: who.userId });
    });
  }

  async revokeAllSessions(who: Access): Promise<void> {
    await this.sys(async () => {
      await this.repo.revokeSessions(who.userId, this.clock.now());
      await this.audit.record({ actorId: who.userId, action: "raqib.sessions.revoked", resourceType: "user", resourceId: who.userId });
    });
  }

  // ── second factor enrollment ──────────────────────────────────────────

  async status(who: Access): Promise<SecurityStatus> {
    const { settings } = await this.policyFor(who.userId, who.organizationId);
    const sec = await this.sys(() => this.repo.security(who.userId));
    const p = policyOf(settings, who.role);
    const enabled = !!sec?.mfaEnabledAt;
    const expired = passwordExpired(sec, p.rotateDays, this.clock.now());
    // what the organization's rules require of this person before they can work (empty while enforcement is off, e.g. a demo)
    const setupRequired: SecurityStatus["setupRequired"] = [];
    if (accountPolicyEnforced()) {
      if (p.mfaRequired && !enabled) setupRequired.push("mfa");
      if (expired) setupRequired.push("password");
    }
    return {
      mfa: { enabled, pending: !!sec?.mfaSecret && !enabled, required: p.mfaRequired, recoveryLeft: sec?.mfaRecovery.length ?? 0 },
      password: { changedAt: sec?.passwordChangedAt?.toISOString() ?? null, expired, minLength: p.minPasswordLength, rotateDays: p.rotateDays },
      sessionMinutes: p.sessionMinutes,
      setupRequired,
    };
  }

  /** What the access guard needs: which set-up steps block this person right now (empty when enforcement is off). */
  async blockingSteps(who: Access): Promise<Array<"mfa" | "password">> {
    if (!accountPolicyEnforced()) return []; // no lookups on the hot path while enforcement is off
    return (await this.status(who)).setupRequired;
  }

  async beginMfa(who: Access): Promise<{ secret: string; uri: string }> {
    const sec = await this.sys(() => this.repo.security(who.userId));
    if (sec?.mfaEnabledAt) throw ValidationError("raqib.mfa_already_enabled", "A second factor is already enabled. Disable it first to enrol a new device.");
    const email = (await this.sys(() => this.repo.userEmail(who.userId))) ?? who.userId;
    const secret = newSecret();
    await this.sys(() => this.repo.beginMfa(who.userId, seal(secret), this.clock.now()));
    return { secret, uri: otpauthUri(secret, email, "Raqib") };
  }

  /** Confirm the device with a first code; returns the recovery codes, shown once. */
  async enableMfa(who: Access, code: string): Promise<{ recoveryCodes: string[] }> {
    const sec = await this.sys(() => this.repo.security(who.userId));
    if (!sec?.mfaSecret || sec.mfaEnabledAt) throw ValidationError("raqib.mfa_not_pending", "Start the set-up first.");
    const now = this.clock.now();
    const step = verifyTotp(open(sec.mfaSecret), code, now, null);
    if (step === null) throw ValidationError("raqib.mfa_invalid", "That code is not valid. Check the time on your phone and try again.");
    const codes = newRecoveryCodes();
    await this.sys(async () => {
      await this.repo.enableMfa(
        who.userId,
        now,
        step,
        codes.map((c) => sha(c)),
      );
      await this.audit.record({ actorId: who.userId, action: "raqib.mfa.enabled", resourceType: "user", resourceId: who.userId });
    });
    return { recoveryCodes: codes };
  }

  /** Turn the second factor off. Refused for roles the organization requires it for; needs the password and a current code. */
  async disableMfa(who: Access, password: string, code: string): Promise<void> {
    const { settings } = await this.policyFor(who.userId, who.organizationId);
    if (mfaRequiredFor(settings, who.role)) throw Forbidden("raqib.mfa_required_by_policy", "Your organization requires a second factor for your role.");
    const hash = await this.sys(() => this.repo.userPasswordHash(who.userId));
    if (!hash || !(await argon2Hasher.verify(hash, password))) throw Unauthenticated("raqib.wrong_password", "The password is not correct.");
    const sec = await this.sys(() => this.repo.security(who.userId));
    if (!sec?.mfaEnabledAt || !sec.mfaSecret) return;
    if (verifyTotp(open(sec.mfaSecret), code, this.clock.now(), sec.mfaLastStep) === null && !sec.mfaRecovery.includes(sha(code.trim().toLowerCase())))
      throw ValidationError("raqib.mfa_invalid", "That code is not valid.");
    await this.sys(async () => {
      await this.repo.disableMfa(who.userId, this.clock.now());
      await this.audit.record({ actorId: who.userId, action: "raqib.mfa.disabled", resourceType: "user", resourceId: who.userId });
    });
  }

  /** An administrator clears someone's second factor (lost phone and recovery codes). Audited with a reason; they re-enrol next sign-in. */
  async adminResetMfa(userId: string, reason: string, who: Access): Promise<void> {
    if (userId === who.userId) throw Forbidden("raqib.self_reset", "Use the account page to change your own second factor.");
    if (reason.trim().length < 3) throw ValidationError("raqib.reason_required", "A reason is required.");
    const target = await this.uow.transaction(() => this.profiles.profile(userId));
    if (!target) throw NotFound("raqib.user_not_found", "User not found.");
    await this.sys(async () => {
      await this.repo.disableMfa(userId, this.clock.now());
      await this.repo.revokeSessions(userId, this.clock.now());
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.mfa.reset_by_admin",
        resourceType: "user",
        resourceId: userId,
        metadata: { reason: reason.trim() },
      });
    });
  }
}
