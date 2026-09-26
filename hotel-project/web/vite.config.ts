import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
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
    port: 4500,
    // Same convention as mizan/web and atlas/web: relative `/api/...` calls proxy to the
    // product backend (hotel-project/backend, once it exists).
    proxy: {
      "/api": {
        target: process.env.HOTEL_API_PROXY_TARGET ?? "http://localhost:3200",
        changeOrigin: true,
      },
    },
  },
});
