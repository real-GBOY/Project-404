import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("organizations")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("settings", "jsonb", (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("organization_members")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organization_id", "text", (c) =>
      c.notNull().references("organizations.id").onDelete("cascade"),
    )
    .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("membership_role", "text", (c) => c.notNull().defaultTo("member"))
    .addColumn("joined_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("organization_members_uq", ["organization_id", "user_id"])
    .execute();

  await db.schema
    .createIndex("organization_members_user_idx")
    .on("organization_members")
    .column("user_id")
    .execute();

  await sql`
    create trigger organizations_set_updated_at before update on organizations
    for each row execute function auric_set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("organization_members").ifExists().execute();
  await db.schema.dropTable("organizations").ifExists().execute();
}
