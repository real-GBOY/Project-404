import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // SWC transforms decorators + emits `design:*` metadata (esbuild does not),
  // which Nest's DI container needs for constructor injection.
  plugins: [swc.vite()],
  resolve: {
    alias: { "@core": `${root}src/core` },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Integration tests that need a live Postgres opt in via AURIC_TEST_DATABASE_URL.
    passWithNoTests: true,
    // The integration suites share one throwaway database and each resets its
    // schema in beforeAll — they must not run concurrently with each other.
    fileParallelism: false,
    setupFiles: ["src/core/tests/setup.ts"],
  },
});
