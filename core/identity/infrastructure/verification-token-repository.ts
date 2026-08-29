import crypto from "node:crypto";
import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { Clock } from "../../kernel/clock.js";

export type VerificationPurpose = "email_verification" | "password_reset";

/**
 * One-time tokens for email verification and password reset. The plaintext
 * token goes to the user (by email); only its SHA-256 hash is stored, so a
 * database leak does not hand out working reset links.
 */
export class VerificationTokenRepository {
  constructor(private readonly clock: Clock) {}

  private hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async issue(params: {
    userId: string;
    purpose: VerificationPurpose;
    ttlSeconds: number;
  }): Promise<string> {
    // Invalidate any outstanding token for the same purpose first.
    await currentExecutor()
      .updateTable("verification_tokens")
      .set({ consumed_at: this.clock.now() })
      .where("user_id", "=", params.userId)
      .where("purpose", "=", params.purpose)
      .where("consumed_at", "is", null)
      .execute();

    const token = crypto.randomBytes(32).toString("base64url");
    await currentExecutor()
      .insertInto("verification_tokens")
      .values({
        id: newId("vt"),
        user_id: params.userId,
        purpose: params.purpose,
        token_hash: this.hash(token),
        expires_at: new Date(this.clock.now().getTime() + params.ttlSeconds * 1000),
      })
      .execute();
    return token;
  }

  /** Returns the userId if the token is valid and unconsumed, and consumes it. */
  async consume(token: string, purpose: VerificationPurpose): Promise<string | null> {
    const row = await currentExecutor()
      .selectFrom("verification_tokens")
      .select(["id", "user_id", "expires_at", "consumed_at"])
      .where("token_hash", "=", this.hash(token))
      .where("purpose", "=", purpose)
      .executeTakeFirst();

    if (!row || row.consumed_at || new Date(row.expires_at) < this.clock.now()) return null;

    const res = await currentExecutor()
      .updateTable("verification_tokens")
      .set({ consumed_at: this.clock.now() })
      .where("id", "=", row.id)
      .where("consumed_at", "is", null)
      .executeTakeFirst();

    return Number(res.numUpdatedRows ?? 0) === 1 ? row.user_id : null;
  }
}
