import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env — do it here so `AURIC_DATABASE_URL`
// (the same var the runtime uses, see core/kernel/config) is available to
// `prisma db pull` / `prisma generate`.
loadEnv();

export default defineConfig({
  schema: "prisma/schema",
  datasource: {
    // Same var the runtime uses (core/kernel/config).
    url: env("AURIC_DATABASE_URL"),
  },
  // Where `prisma migrate` will write once the migrator cutover happens
  // (docs/integration-guide.md). Nothing is here yet — Kysely still migrates.
  migrations: {
    path: "prisma/migrations",
  },
});
