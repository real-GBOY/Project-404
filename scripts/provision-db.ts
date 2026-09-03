import pg from "pg";
import { getConfig } from "@core/kernel/config.js";

/**
 * One-time (idempotent) database bootstrap for the multi-tenancy RLS backstop
 * (§ docs/tenancy.md). The `..._multitenancy_rls` migration creates the
 * `auric_app` / `auric_system` roles NOLOGIN and sets their RLS attributes;
 * this gives them a LOGIN + password so the runtime can connect as them.
 *
 *   AURIC_DATABASE_URL          — a superuser / CREATEROLE connection (owner)
 *   AURIC_APP_DB_PASSWORD       — password to set on auric_app
 *   AURIC_SYSTEM_DB_PASSWORD    — password to set on auric_system
 *
 *   npx tsx scripts/provision-db.ts
 *
 * Then point the runtime at the two roles:
 *   AURIC_APP_DATABASE_URL     = postgres://auric_app:<pw>@host/db
 *   AURIC_SYSTEM_DATABASE_URL  = postgres://auric_system:<pw>@host/db
 */
async function main() {
  const { databaseUrl } = getConfig();
  const appPw = requireEnv("AURIC_APP_DB_PASSWORD");
  const systemPw = requireEnv("AURIC_SYSTEM_DB_PASSWORD");

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const [role, pw, bypass] of [
      ["auric_app", appPw, false],
      ["auric_system", systemPw, true],
    ] as const) {
      await client.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
             CREATE ROLE "${role}" LOGIN;
           END IF;
         END $$;`,
      );
      // `ALTER ROLE ... PASSWORD` is a utility statement — it does not accept
      // bind parameters ($1), so the password is escaped and inlined.
      await client.query(
        `ALTER ROLE "${role}" LOGIN PASSWORD ${client.escapeLiteral(pw)} ` +
          `${bypass ? "BYPASSRLS" : "NOBYPASSRLS"}`,
      );
    }
    console.log("✓ auric_app / auric_system provisioned");
  } finally {
    await client.end();
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
