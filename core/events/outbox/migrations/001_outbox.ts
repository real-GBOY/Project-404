import { type Kysely, type SqlBool, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("outbox_messages")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("event_name", "text", (c) => c.notNull())
    .addColumn("payload", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("max_attempts", "integer", (c) => c.notNull())
    .addColumn("next_attempt_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("last_error", "text")
    .addColumn("locked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("delivered_at", "timestamptz")
    .addCheckConstraint(
      "outbox_status_check",
      sql`status in ('pending','processing','delivered','failed')`,
    )
    .execute();

  // The worker's claim query: pending rows whose retry time has arrived.
  await db.schema
    .createIndex("outbox_ready_idx")
    .on("outbox_messages")
    .columns(["next_attempt_at"])
    .where(sql<SqlBool>`status = 'pending'`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("outbox_messages").ifExists().execute();
}
