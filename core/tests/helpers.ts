import pg from "pg";
import { setConfigForTests } from "../kernel/config.js";

/**
 * Integration tests run against a real Postgres (the modular monolith owns
 * its schema, §5). Point them at a throwaway database with
 * AURIC_TEST_DATABASE_URL; without it, integration suites are skipped.
 */
export const TEST_DATABASE_URL =
  process.env.AURIC_TEST_DATABASE_URL ??
  (process.env.CI ? undefined : "postgres://postgres:postgres@localhost:5432/auric_test");

export const hasTestDb = Boolean(TEST_DATABASE_URL);

export async function resetSchema(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }
}

export function applyTestConfig(): void {
  setConfigForTests({
    databaseUrl: TEST_DATABASE_URL!,
    nodeEnv: "test",
    jwtSecret: "test-secret",
    logLevel: "silent",
    outboxPollIntervalMs: 50,
  });
}
