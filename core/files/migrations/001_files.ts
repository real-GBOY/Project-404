import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("files")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("storage_key", "text", (c) => c.notNull())
    .addColumn("driver", "text", (c) => c.notNull())
    .addColumn("original_name", "text", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("byte_size", "bigint", (c) => c.notNull())
    .addColumn("checksum_sha256", "text", (c) => c.notNull())
    // No FK to users: file metadata outlives the uploader (§7.7-style retention).
    .addColumn("owner_id", "text")
    .addColumn("visibility", "text", (c) => c.notNull().defaultTo("private"))
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint("files_visibility_check", sql`visibility in ('private','public')`)
    .execute();

  await db.schema.createIndex("files_owner_idx").on("files").column("owner_id").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("files").ifExists().execute();
}
