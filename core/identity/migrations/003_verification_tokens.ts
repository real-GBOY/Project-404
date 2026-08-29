import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("verification_tokens")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("purpose", "text", (c) => c.notNull())
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("expires_at", "timestamptz", (c) => c.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      "verification_tokens_purpose_check",
      sql`purpose in ('email_verification','password_reset')`,
    )
    .execute();

  await db.schema
    .createIndex("verification_tokens_user_purpose_idx")
    .on("verification_tokens")
    .columns(["user_id", "purpose"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("verification_tokens").ifExists().execute();
}
