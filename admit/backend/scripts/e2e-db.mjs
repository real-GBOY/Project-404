// Creates a clean database for the browser end-to-end tests (web/e2e). Never touches any other database.
import pg from "pg";

const admin = process.env.ADMIT_E2E_PG_ADMIN ?? "postgres://postgres:postgres@localhost:5432/postgres";
const name = process.env.ADMIT_E2E_DB ?? "admit_e2e";
if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Refusing unusual database name "${name}"`);
const c = new pg.Client({ connectionString: admin });
await c.connect();
try {
  await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${name}"`);
  console.log(`database ${name} ready`);
} finally {
  await c.end();
}
