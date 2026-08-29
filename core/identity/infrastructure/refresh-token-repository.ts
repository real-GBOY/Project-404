import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { Clock } from "../../kernel/clock.js";

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedTo: string | null;
}

export class RefreshTokenRepository {
  constructor(private readonly clock: Clock) {}

  async create(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
  }): Promise<string> {
    const id = newId("rt");
    await currentExecutor()
      .insertInto("refresh_tokens")
      .values({
        id,
        user_id: params.userId,
        token_hash: params.tokenHash,
        expires_at: params.expiresAt,
        user_agent: params.userAgent ?? null,
      })
      .execute();
    return id;
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const row = await currentExecutor()
      .selectFrom("refresh_tokens")
      .select(["id", "user_id", "expires_at", "revoked_at", "rotated_to"])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      rotatedTo: row.rotated_to,
    };
  }

  async revoke(id: string, rotatedTo?: string): Promise<void> {
    await currentExecutor()
      .updateTable("refresh_tokens")
      .set({ revoked_at: this.clock.now(), rotated_to: rotatedTo ?? null })
      .where("id", "=", id)
      .where("revoked_at", "is", null)
      .execute();
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const res = await currentExecutor()
      .updateTable("refresh_tokens")
      .set({ revoked_at: this.clock.now() })
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    return Number(res.numUpdatedRows ?? 0);
  }
}
