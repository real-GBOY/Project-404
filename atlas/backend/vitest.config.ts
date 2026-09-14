import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [swc.vite()],
  resolve: {
    alias: {
      "@core": `${root}../../core`,
      "@atlas": `${root}app`,
    },
  },
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
    globals: false,
    passWithNoTests: false,
    // Integration suites share one throwaway database and reset its schema in
    // beforeAll — they must not run concurrently with each other.
    fileParallelism: false,
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
        "app/realestate/db/schema.ts",
        "**/demo/**",
      ],
    },
  },
});
