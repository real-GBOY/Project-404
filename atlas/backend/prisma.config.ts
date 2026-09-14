import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env — do it here so `AURIC_DATABASE_URL`
// (the same var the runtime uses, see app/../../core/kernel/config) is
// available to `prisma db pull` / `prisma generate` / `prisma migrate`.
loadEnv();

export default defineConfig({
  schema: "prisma/schema",
  datasource: {
    url: env("AURIC_DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
