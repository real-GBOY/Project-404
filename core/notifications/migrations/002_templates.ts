import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("notification_templates")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("key", "text", (c) => c.notNull())
    .addColumn("locale", "text", (c) => c.notNull())
    .addColumn("channel", "text", (c) => c.notNull())
    .addColumn("subject", "text")
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("notification_templates_uq", ["key", "locale", "channel"])
    .addCheckConstraint("notification_templates_channel_check", sql`channel in ('in_app','email')`)
    .execute();

  await sql`
    create trigger notification_templates_set_updated_at before update on notification_templates
    for each row execute function auric_set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("notification_templates").ifExists().execute();
}
