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
  server: {
    port: 4300,
    proxy: {
      // Real backend during dev when VITE_API_MOCKS=off.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Constrained CI/sandbox: one worker, no child-process fan-out.
    pool: "threads",
    poolOptions: { threads: { singleThread: true, maxThreads: 1, minThreads: 1 } },
    fileParallelism: false,
  },
});
