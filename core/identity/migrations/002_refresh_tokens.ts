import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("refresh_tokens")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("expires_at", "timestamptz", (c) => c.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("rotated_to", "text")
    .addColumn("user_agent", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("refresh_tokens_user_idx").on("refresh_tokens").column("user_id").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("refresh_tokens").ifExists().execute();
}
