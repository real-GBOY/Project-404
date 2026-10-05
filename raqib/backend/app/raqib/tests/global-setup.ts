import pg from "pg";

/**
 * Vitest global setup: make sure RaqibOS's throwaway test database exists. Each integration suite
 * then resets its `public` schema and re-applies every migration from zero (see `helpers.ts`), so
 * the database only has to exist — creating it here keeps `npm test` a one-command run on a fresh
 * machine or CI container. Only ever touches the database named in AURIC_TEST_DATABASE_URL.
 */
export default async function setup(): Promise<void> {
  const url = process.env.AURIC_TEST_DATABASE_URL;
  if (!url) return; // integration suites skip themselves (hasTestDb === false)

  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Refusing unusual test database name "${dbName}"`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
}
