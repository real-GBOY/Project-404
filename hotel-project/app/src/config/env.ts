/** Every environment-driven constant the app needs, in one place. */

// Same-origin `/api` by default (the Vite dev proxy locally; nginx in front of the API on the
// VPS). An absolute URL is baked in at build time when the app is served from another origin
// (e.g. Vercel) — the same `VITE_API_BASE` convention as mizan/web and atlas/web.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "/api";

// The public Hotel Nayel website (hotel-project/web), linked from the sidebar.
export const PUBLIC_SITE_URL: string =
  import.meta.env.VITE_PUBLIC_SITE_URL ?? "https://hotel-nayel.vercel.app";

// Optional sign-in prefill for demo deployments (mizan/web convention). Empty in real use.
export const DEMO_EMAIL: string = import.meta.env.VITE_DEMO_EMAIL ?? "";
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? "";
