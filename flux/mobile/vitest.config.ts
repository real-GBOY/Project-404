import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests cover the pure logic (engine, workout reducers, persistence); no RN runtime needed. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { __DEV__: false },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
