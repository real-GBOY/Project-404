// Drops and recreates the HotelOS end-to-end database so every Playwright run starts from an
// empty schema: the backend then migrates from zero and seeds the Hotel Transylvania demo on boot.
// Runs as the first half of the backend webServer command (playwright.config.ts), so it is
// guaranteed to finish before the API starts. Only ever touches the database it is given.
import pg from "pg";

const url = new URL(process.env.AURIC_DATABASE_URL ?? "");
const dbName = decodeURIComponent(url.pathname.slice(1));
if (!/_e2e$/.test(dbName)) {
  console.error(`reset-db: refusing to reset "${dbName}" (name must end in _e2e)`);
  process.exit(1);
}
url.pathname = "/postgres";
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}"`);
} finally {
  await client.end();
}
console.log(`reset-db: ${dbName} recreated`);
