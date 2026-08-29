import { type Kysely, sql } from "kysely";

/**
 * Shared database bootstrap. Runs before every module migration.
 * - citext for case-insensitive text where useful
 * - a reusable trigger function that keeps `updated_at` current
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create extension if not exists "citext"`.execute(db);

  await sql`
    create or replace function auric_set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop function if exists auric_set_updated_at() cascade`.execute(db);
}
