import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor } from "@core/kernel/db/db.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";

export interface SecurityRow {
  userId: string;
  passwordChangedAt: Date | null;
  mfaSecret: string | null;
  mfaEnabledAt: Date | null;
  mfaLastStep: number | null;
  mfaRecovery: string[];
}

export interface Throttle {
  failures: number;
  firstFailureAt: Date;
  lockedUntil: Date | null;
}

export interface LoginUser {
  id: string;
  passwordHash: string;
  organizationId: string | null;
}

/** Account-level (not tenant-scoped) rows: callers run as the system role. */
@Injectable()
export class AccountRepository {
  async security(userId: string): Promise<SecurityRow | null> {
    const r = await raqibDb().selectFrom("raqib_account_security").selectAll().where("user_id", "=", userId).executeTakeFirst();
    return r
      ? {
          userId: r.user_id,
          passwordChangedAt: r.password_changed_at,
          mfaSecret: r.mfa_secret,
          mfaEnabledAt: r.mfa_enabled_at,
          mfaLastStep: r.mfa_last_step === null ? null : Number(r.mfa_last_step),
          mfaRecovery: r.mfa_recovery as string[],
        }
      : null;
  }

  async stampPassword(userId: string, at: Date): Promise<void> {
    await raqibDb()
      .insertInto("raqib_account_security")
      .values({ user_id: userId, password_changed_at: at })
      .onConflict((oc) => oc.column("user_id").doUpdateSet({ password_changed_at: at, updated_at: at }))
      .execute();
  }

  /** Store a pending (not yet enabled) secret; replaces any earlier pending one. */
  async beginMfa(userId: string, sealedSecret: string, at: Date): Promise<void> {
    await raqibDb()
      .insertInto("raqib_account_security")
      .values({ user_id: userId, mfa_secret: sealedSecret, mfa_enabled_at: null, mfa_last_step: null, mfa_recovery: "[]" as never })
      .onConflict((oc) =>
        oc.column("user_id").doUpdateSet({ mfa_secret: sealedSecret, mfa_enabled_at: null, mfa_last_step: null, mfa_recovery: "[]" as never, updated_at: at }),
      )
      .execute();
  }

  async enableMfa(userId: string, at: Date, step: number, recoveryHashes: string[]): Promise<void> {
    await raqibDb()
      .updateTable("raqib_account_security")
      .set({ mfa_enabled_at: at, mfa_last_step: String(step), mfa_recovery: JSON.stringify(recoveryHashes) as never, updated_at: at })
      .where("user_id", "=", userId)
      .execute();
  }

  async disableMfa(userId: string, at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_account_security")
      .set({ mfa_secret: null, mfa_enabled_at: null, mfa_last_step: null, mfa_recovery: "[]" as never, updated_at: at })
      .where("user_id", "=", userId)
      .execute();
  }

  async useStep(userId: string, step: number, at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_account_security")
      .set({ mfa_last_step: String(step), updated_at: at })
      .where("user_id", "=", userId)
      .execute();
  }

  async setRecovery(userId: string, hashes: string[], at: Date): Promise<void> {
    await raqibDb()
      .updateTable("raqib_account_security")
      .set({ mfa_recovery: JSON.stringify(hashes) as never, updated_at: at })
      .where("user_id", "=", userId)
      .execute();
  }

  // ── sign-in throttle ──────────────────────────────────────────────────

  async throttle(email: string): Promise<Throttle | null> {
    const r = await raqibDb().selectFrom("raqib_auth_throttle").selectAll().where("email_normalized", "=", email).executeTakeFirst();
    return r ? { failures: r.failures, firstFailureAt: r.first_failure_at, lockedUntil: r.locked_until } : null;
  }

  /**
   * Count one wrong attempt atomically (concurrent guesses cannot slip past the limit). Attempts older than the window
   * start a new count; reaching `max` locks the address until `lockUntil`. `max <= 0` records nothing.
   */
  async recordFailure(email: string, now: Date, windowStart: Date, max: number, lockUntil: Date): Promise<Throttle> {
    const res = await sql<{ failures: number; first_failure_at: Date; locked_until: Date | null }>`
      INSERT INTO raqib_auth_throttle (email_normalized, failures, first_failure_at, locked_until, updated_at)
      VALUES (${email}, 1, ${now}, ${max <= 1 ? lockUntil : null}, ${now})
      ON CONFLICT (email_normalized) DO UPDATE SET
        failures = CASE WHEN raqib_auth_throttle.first_failure_at < ${windowStart} THEN 1 ELSE raqib_auth_throttle.failures + 1 END,
        first_failure_at = CASE WHEN raqib_auth_throttle.first_failure_at < ${windowStart} THEN ${now} ELSE raqib_auth_throttle.first_failure_at END,
        locked_until = CASE
          WHEN (CASE WHEN raqib_auth_throttle.first_failure_at < ${windowStart} THEN 1 ELSE raqib_auth_throttle.failures + 1 END) >= ${max} THEN ${lockUntil}
          ELSE raqib_auth_throttle.locked_until END,
        updated_at = ${now}
      RETURNING failures, first_failure_at, locked_until`.execute(currentExecutor());
    const r = res.rows[0]!;
    return { failures: r.failures, firstFailureAt: r.first_failure_at, lockedUntil: r.locked_until };
  }

  async clearThrottle(email: string): Promise<void> {
    await raqibDb().deleteFrom("raqib_auth_throttle").where("email_normalized", "=", email).execute();
  }

  async purgeThrottles(before: Date): Promise<number> {
    const r = await raqibDb()
      .deleteFrom("raqib_auth_throttle")
      .where("updated_at", "<", before)
      .where((eb) => eb.or([eb("locked_until", "is", null), eb("locked_until", "<", before)]))
      .executeTakeFirst();
    return Number(r.numDeletedRows);
  }

  // ── identity lookups (Core tables) ────────────────────────────────────

  async loginUser(email: string): Promise<LoginUser | null> {
    const ex = currentExecutor();
    const u = await ex.selectFrom("users").select(["id", "password_hash"]).where("email_normalized", "=", email).executeTakeFirst();
    if (!u) return null;
    const m = await ex.selectFrom("organization_members").select("organization_id").where("user_id", "=", u.id).orderBy("id").executeTakeFirst();
    return { id: u.id, passwordHash: u.password_hash, organizationId: m?.organization_id ?? null };
  }

  async userEmail(userId: string): Promise<string | null> {
    const u = await currentExecutor().selectFrom("users").select("email").where("id", "=", userId).executeTakeFirst();
    return u?.email ?? null;
  }

  async userPasswordHash(userId: string): Promise<string | null> {
    const u = await currentExecutor().selectFrom("users").select("password_hash").where("id", "=", userId).executeTakeFirst();
    return u?.password_hash ?? null;
  }

  async setPasswordHash(userId: string, hash: string, at: Date): Promise<void> {
    await currentExecutor().updateTable("users").set({ password_hash: hash, updated_at: at }).where("id", "=", userId).execute();
  }

  async revokeSessions(userId: string, at: Date): Promise<void> {
    await currentExecutor().updateTable("refresh_tokens").set({ revoked_at: at }).where("user_id", "=", userId).where("revoked_at", "is", null).execute();
  }

  /** The user and organization a still-valid password-reset token belongs to (used to apply that organization's password rule). */
  async resetTokenOwner(tokenHash: string, now: Date): Promise<{ userId: string; organizationId: string | null } | null> {
    const ex = currentExecutor();
    const t = await ex
      .selectFrom("verification_tokens")
      .select("user_id")
      .where("token_hash", "=", tokenHash)
      .where("purpose", "=", "password_reset")
      .where("consumed_at", "is", null)
      .where("expires_at", ">", now)
      .executeTakeFirst();
    if (!t) return null;
    const m = await ex.selectFrom("organization_members").select("organization_id").where("user_id", "=", t.user_id).orderBy("id").executeTakeFirst();
    return { userId: t.user_id, organizationId: m?.organization_id ?? null };
  }
}
