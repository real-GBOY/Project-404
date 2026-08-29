import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("notifications")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("locale", "text", (c) => c.notNull())
    .addColumn("data", "jsonb")
    .addColumn("read_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("notifications_user_unread_idx")
    .on("notifications")
    .columns(["user_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("notifications").ifExists().execute();
}
