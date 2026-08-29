import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("roles")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("key", "text", (c) => c.notNull().unique())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("is_system", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("permissions")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("key", "text", (c) => c.notNull().unique())
    .addColumn("action", "text", (c) => c.notNull())
    .addColumn("resource", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("permissions_action_resource_uq", ["action", "resource"])
    .execute();

  await db.schema
    .createTable("role_permissions")
    .addColumn("role_id", "text", (c) => c.notNull().references("roles.id").onDelete("cascade"))
    .addColumn("permission_id", "text", (c) =>
      c.notNull().references("permissions.id").onDelete("cascade"),
    )
    .addPrimaryKeyConstraint("role_permissions_pk", ["role_id", "permission_id"])
    .execute();

  await db.schema
    .createTable("user_roles")
    .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("role_id", "text", (c) => c.notNull().references("roles.id").onDelete("cascade"))
    .addColumn("granted_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("granted_by", "text")
    .addPrimaryKeyConstraint("user_roles_pk", ["user_id", "role_id"])
    .execute();

  await db.schema.createIndex("user_roles_user_idx").on("user_roles").column("user_id").execute();

  await sql`
    create trigger roles_set_updated_at before update on roles
    for each row execute function auric_set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("user_roles").ifExists().execute();
  await db.schema.dropTable("role_permissions").ifExists().execute();
  await db.schema.dropTable("permissions").ifExists().execute();
  await db.schema.dropTable("roles").ifExists().execute();
}
