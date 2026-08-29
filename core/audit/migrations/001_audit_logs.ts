import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("audit_logs")
    .addColumn("id", "text", (c) => c.primaryKey())
    // No FK to users on purpose: the trail must survive user deletion and
    // must never be touched by a cascade (§7.7 "immutable trail").
    .addColumn("actor_id", "text")
    .addColumn("actor_type", "text", (c) => c.notNull().defaultTo("user"))
    .addColumn("action", "text", (c) => c.notNull())
    .addColumn("resource_type", "text", (c) => c.notNull())
    .addColumn("resource_id", "text")
    .addColumn("before", "jsonb")
    .addColumn("after", "jsonb")
    .addColumn("metadata", "jsonb")
    .addColumn("correlation_id", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("audit_actor_type_check", sql`actor_type in ('user','system')`)
    .execute();

  await db.schema
    .createIndex("audit_logs_resource_idx")
    .on("audit_logs")
    .columns(["resource_type", "resource_id"])
    .execute();
  await db.schema.createIndex("audit_logs_actor_idx").on("audit_logs").column("actor_id").execute();
  await db.schema.createIndex("audit_logs_created_idx").on("audit_logs").column("created_at").execute();

  // Immutability at the database level: block UPDATE and DELETE.
  await sql`
    create or replace function auric_audit_immutable()
    returns trigger as $$
    begin
      raise exception 'audit_logs is append-only';
    end;
    $$ language plpgsql
  `.execute(db);
  await sql`
    create trigger audit_logs_no_mutation
    before update or delete on audit_logs
    for each row execute function auric_audit_immutable()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop trigger if exists audit_logs_no_mutation on audit_logs`.execute(db);
  await sql`drop function if exists auric_audit_immutable()`.execute(db);
  await db.schema.dropTable("audit_logs").ifExists().execute();
}
