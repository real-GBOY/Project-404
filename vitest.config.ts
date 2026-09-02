import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // SWC transforms decorators + emits `design:*` metadata (esbuild does not),
  // which Nest's DI container needs for constructor injection.
  plugins: [swc.vite()],
  resolve: {
    // Same aliases as tsconfig.json / .swcrc so tests import `@core/*` / `@app/*`.
    alias: {
      "@core": `${root}core`,
      "@app": `${root}mizan/backend/app`,
    },
  },
  test: {
    include: ["core/**/*.test.ts", "mizan/backend/app/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Integration tests that need a live Postgres opt in via AURIC_TEST_DATABASE_URL.
    passWithNoTests: false,
    // The integration suites share one throwaway database and each resets its
    // schema in beforeAll — they must not run concurrently with each other.
    fileParallelism: false,
    setupFiles: ["core/tests/setup.ts"],
  },
});
