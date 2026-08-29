import { migrateToLatest, migrationStatus } from "../core/kernel/db/migrate.js";
import { getConfig } from "../core/kernel/config.js";

/**
 * Migrations are owned by Prisma (Plan §2). This is a thin wrapper over
 * `prisma migrate deploy` / `prisma migrate status` so the familiar
 * `npm run migrate` / `migrate:status` scripts keep working.
 *
 *   npm run migrate           # apply all pending (prisma migrate deploy)
 *   npm run migrate:status    # show migration state
 *
 * To author a new migration during development, use Prisma directly:
 *   npx prisma migrate dev --name <change>
 * There is no `migrate:down` — Prisma rolls forward. Write a new migration
 * (or `npx prisma migrate diff` + `prisma db execute`) to undo something.
 */
async function main() {
  const command = process.argv[2] ?? "up";
  const { databaseUrl } = getConfig();

  if (command === "status") {
    console.log(await migrationStatus(databaseUrl));
    return;
  }

  if (command === "down") {
    console.error(
      "`migrate:down` is gone with the Prisma cutover — Prisma migrations roll " +
        "forward. Add a new migration to reverse a change.",
    );
    process.exitCode = 1;
    return;
  }

  await migrateToLatest(databaseUrl);
  console.log("✓ database is up to date");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
