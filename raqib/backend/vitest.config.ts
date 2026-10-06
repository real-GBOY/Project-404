import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Raqib's own throwaway integration database — never Mizan's `auric_test` or Atlas's
// `atlas_test`. CI (and anyone else) can point elsewhere with AURIC_TEST_DATABASE_URL. Set on
// this process's env (not just `test.env`) so `globalSetup`, which runs here, sees it too.
process.env.AURIC_TEST_DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/raqib_test";
const testDatabaseUrl = process.env.AURIC_TEST_DATABASE_URL;

export default defineConfig({
  plugins: [swc.vite()],
  resolve: {
    alias: {
      "@core": `${root}../../core`,
      "@raqib": `${root}app`,
    },
  },
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
    globals: false,
    passWithNoTests: false,
    // Tests never inherit a developer's local .env choices (e.g. RAQIB_SEED_DEMO=true, an R2 bucket):
    // suites seed the demo explicitly when they need it.
    env: {
      AURIC_TEST_DATABASE_URL: testDatabaseUrl,
      RAQIB_SEED_DEMO: "false",
      // uploads in tests go to disk, never to a developer's real bucket, and PDF rendering is not needed
      AURIC_FILE_STORAGE_DRIVER: "local",
      RAQIB_CHROMIUM_PATH: "",
      RAQIB_DEMO_HISTORY_DAYS: "14",
      RAQIB_TRUSTED_PROXY_HOPS: "1",
    },
    // Integration suites share one throwaway database and reset its schema in
    // beforeAll — they must not run concurrently with each other.
    fileParallelism: false,
    globalSetup: ["app/raqib/tests/global-setup.ts"],
    setupFiles: ["../../core/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["app/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/tests/**",
        "**/*.module.ts",
        "**/permissions.ts",
        "**/permissions/**",
        "**/events/events.ts",
        "**/*.events.ts",
        "app/raqib/db/schema.ts",
        "**/demo/**",
      ],
    },
  },
});
