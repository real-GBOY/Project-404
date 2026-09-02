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
    rollupOptions: {
      output: {
        // Split the vendor deps so they cache independently of app code.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler"))
            return "react";
          if (id.includes("@radix-ui") || id.includes("@floating-ui") || id.includes("aria-hidden"))
            return "radix";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("i18next")) return "i18n";
          if (id.includes("zod") || id.includes("hookform") || id.includes("react-hook-form"))
            return "forms";
          return "vendor";
        },
      },
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
