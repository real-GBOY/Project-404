import { createMigrator } from "../core/kernel/db/migrator.js";
import { closeDb } from "../core/kernel/db/db.js";
import { closePool } from "../core/kernel/db/pool.js";

/**
 * Usage:
 *   npm run migrate            # apply all pending
 *   npm run migrate:down       # roll back the latest
 *   npm run migrate:status     # list migrations and their state
 */
async function main() {
  const command = process.argv[2] ?? "up";
  const migrator = createMigrator();

  if (command === "status") {
    const migrations = await migrator.getMigrations();
    for (const m of migrations) {
      const mark = m.executedAt ? "✓" : "·";
      console.log(`${mark} ${m.name}${m.executedAt ? `  (${m.executedAt.toISOString()})` : ""}`);
    }
    return;
  }

  const { error, results } =
    command === "down" ? await migrator.migrateDown() : await migrator.migrateToLatest();

  for (const r of results ?? []) {
    const verb = r.direction === "Up" ? "applied" : "reverted";
    if (r.status === "Success") console.log(`✓ ${verb} ${r.migrationName}`);
    else if (r.status === "Error") console.error(`✗ failed ${r.migrationName}`);
  }

  if (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } else if (!results?.length) {
    console.log("Nothing to do — database is up to date.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb().catch(() => {});
    await closePool().catch(() => {});
  });
