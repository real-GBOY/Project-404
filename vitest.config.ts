import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/**/*.test.ts"],
    environment: "node",
    // Integration tests that need a live Postgres opt in via AURIC_TEST_DATABASE_URL.
    passWithNoTests: false,
  },
});
