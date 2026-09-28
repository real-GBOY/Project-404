import { copyFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Emits dist/404.html (a copy of index.html). Static hosts such as Vercel serve it for any
 * unknown URL with a real 404 status; the app then sees a non-root path and renders NotFoundPage.
 */
function notFoundPage(): Plugin {
  return {
    name: "hotel:404-html",
    apply: "build",
    closeBundle() {
      const dist = (file: string) => fileURLToPath(new URL(`./dist/${file}`, import.meta.url));
      copyFileSync(dist("index.html"), dist("404.html"));
    },
  };
}

/**
 * Public site address for canonical/share URLs. Set SITE_URL for a custom domain; on Vercel it
 * falls back to the project's production domain automatically. Empty in local dev (relative URLs).
 */
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/+$/, "");

/** Fills `__SITE_URL__` in index.html and emits robots.txt + sitemap.xml at build time. */
function seo(): Plugin {
  return {
    name: "hotel:seo",
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl),
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ""}`,
      });
      if (!siteUrl) return;
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${siteUrl}/</loc></url>\n` +
          "</urlset>\n",
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seo(), notFoundPage()],
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
