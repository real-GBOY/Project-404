import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { UserEntity } from "@core/identity/domain/user.js";

/** The only place that knows how a user is stored (§3.4). */
@Injectable()
export class UserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    const row = await currentExecutor()
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await currentExecutor()
      .selectFrom("users")
      .selectAll()
      .where("email_normalized", "=", UserEntity.normalizeEmail(email))
      .executeTakeFirst();
    return row ? this.toEntity(row) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await currentExecutor()
      .selectFrom("users")
      .select("id")
      .where("email_normalized", "=", UserEntity.normalizeEmail(email))
      .executeTakeFirst();
    return row !== undefined;
  }

  async exists(id: string): Promise<boolean> {
    const row = await currentExecutor()
      .selectFrom("users")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
    return row !== undefined;
  }

  async insert(user: UserEntity): Promise<void> {
    const s = user.toSnapshot();
    await currentExecutor()
      .insertInto("users")
      .values({
        id: s.id,
        email: s.email,
        email_normalized: s.emailNormalized,
        password_hash: s.passwordHash,
        display_name: s.displayName,
        status: s.status,
        email_verified_at: s.emailVerifiedAt,
        locale: s.locale,
      })
      .execute();
  }

  async update(user: UserEntity): Promise<void> {
    const s = user.toSnapshot();
    await currentExecutor()
      .updateTable("users")
      .set({
        password_hash: s.passwordHash,
        display_name: s.displayName,
        status: s.status,
        email_verified_at: s.emailVerifiedAt,
        locale: s.locale,
      })
      .where("id", "=", s.id)
      .execute();
  }

  private toEntity(row: {
    id: string;
    email: string;
    email_normalized: string;
    password_hash: string;
    display_name: string | null;
    status: string;
    email_verified_at: Date | null;
    locale: string | null;
  }): UserEntity {
    return UserEntity.rehydrate({
      id: row.id,
      email: row.email,
      emailNormalized: row.email_normalized,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      status: row.status as UserEntity["status"],
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      locale: row.locale,
    });
  }
}
