import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {},
  },
  server: {
    port: 4400,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Same rationale as mizan/web: jsdom's layout/CSS engine plus @floating-ui
    // (Radix Popover/Select/Menu, used heavily here) run pathologically slow
    // inside worker_threads. A single fork is orders of magnitude faster.
    pool: "forks",
    poolOptions: { forks: { singleFork: true, maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
});
