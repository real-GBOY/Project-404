import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@auric/web": fileURLToPath(new URL("../../packages/web/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 4500,
    // Real-backend mode (VITE_API_MODE=http) calls relative /api paths; proxy them to the Raqib backend.
    proxy: { "/api": { target: process.env.RAQIB_API_PROXY_TARGET ?? "http://localhost:3300", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true, maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
});
