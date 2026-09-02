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
    // One isolated worker, no fan-out (constrained CI/sandbox). We use `forks`
    // rather than `threads`: jsdom's CSS/layout engine runs pathologically slow
    // inside worker_threads here, and @floating-ui (Radix Popover/Select/Menu)
    // calls getComputedStyle heavily — a single overlay render took minutes on
    // `threads`, milliseconds on a single fork.
    pool: "forks",
    poolOptions: { forks: { singleFork: true, maxForks: 1, minForks: 1 } },
    fileParallelism: false,
  },
});
