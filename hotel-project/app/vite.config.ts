import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.HOTEL_API_PROXY_TARGET ?? "http://localhost:3200";

export default defineConfig({
  // "/app/" when served beside the public site on one Vercel project (scripts/build-vercel.mjs).
  base: process.env.HOTEL_APP_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@auric/web": fileURLToPath(new URL("../../packages/web/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.HOTEL_APP_PORT ?? 4600),
    strictPort: true,
    // Proxies to the HotelOS backend (hotel-project/backend, port 3200 by default) so the app
    // calls relative `/api/...` paths in dev — the same convention as atlas/web and mizan/web.
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Same rationale as atlas/web + mizan/web: jsdom runs far faster in a single fork than
    // inside worker_threads.
    pool: "forks",
    poolOptions: { forks: { singleFork: true, maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
});
