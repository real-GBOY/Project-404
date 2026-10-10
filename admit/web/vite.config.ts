import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.ADMIT_API_PROXY_TARGET ?? "http://localhost:3400";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@auric/web": fileURLToPath(new URL("../../packages/web/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 4700,
    // Same convention as raqib/web and hotel-project/web: relative `/api/...` calls proxy to the product backend (admit/backend).
    proxy: { "/api": { target: api, changeOrigin: true } },
  },
  preview: { port: 4799, proxy: { "/api": { target: api, changeOrigin: true } } },
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true, maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
});
