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
  build: {
    rollupOptions: {},
  },
  server: {
    port: 4400,
    // Proxies to the Atlas backend (atlas/backend, port 3100 by default) so the
    // app can call relative `/api/...` paths in dev, same convention as
    // mizan/web's own `/api` proxy. Override the backend's own port via
    // ATLAS_API_PROXY_TARGET if you run it elsewhere.
    proxy: {
      "/api": {
        target: process.env.ATLAS_API_PROXY_TARGET ?? "http://localhost:3100",
        changeOrigin: true,
      },
      // Realtime messaging: Socket.IO rides the same backend port. `ws: true` upgrades the WebSocket.
      "/socket.io": {
        target: process.env.ATLAS_API_PROXY_TARGET ?? "http://localhost:3100",
        changeOrigin: true,
        ws: true,
      },
    },
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
