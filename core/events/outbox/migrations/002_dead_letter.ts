import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("dead_letter_messages")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("outbox_id", "text", (c) => c.notNull())
    .addColumn("event_name", "text", (c) => c.notNull())
    .addColumn("payload", "jsonb", (c) => c.notNull())
    .addColumn("attempts", "integer", (c) => c.notNull())
    .addColumn("last_error", "text", (c) => c.notNull())
    .addColumn("retry_history", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("replayed_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("dead_letter_messages").ifExists().execute();
}
