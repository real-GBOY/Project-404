import type { Kysely } from "kysely";
import { Migrator, type MigrationProvider } from "kysely/migration";
import { getDb } from "./db.js";
import { MIGRATIONS } from "./migrations-manifest.js";

/**
 * Migration runner. Each module owns its migrations in
 * `core/<module>/migrations/*.ts` (§3.2); `migrations-manifest.ts` declares
 * their global order. Kysely's Migrator applies them and tracks state in
 * `auric_migrations`.
 */
const manifestProvider: MigrationProvider = {
  async getMigrations() {
    return MIGRATIONS;
  },
};

export function createMigrator(db: Kysely<unknown> = getDb() as unknown as Kysely<unknown>): Migrator {
  return new Migrator({
    db: db as Kysely<Record<string, unknown>>,
    provider: manifestProvider,
    migrationTableName: "auric_migrations",
    migrationLockTableName: "auric_migrations_lock",
  });
}
