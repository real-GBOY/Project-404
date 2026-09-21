import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env — do it here so `AURIC_DATABASE_URL`
// (the same var the runtime uses) is available to every prisma command.
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
