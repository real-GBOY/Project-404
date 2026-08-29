import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("email_normalized", sql`citext`, (c) => c.notNull().unique())
    .addColumn("password_hash", "text", (c) => c.notNull())
    .addColumn("display_name", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("email_verified_at", "timestamptz")
    .addColumn("locale", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("users_status_check", sql`status in ('active','pending','disabled')`)
    .execute();

  await sql`
    create trigger users_set_updated_at before update on users
    for each row execute function auric_set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("users").ifExists().execute();
}
