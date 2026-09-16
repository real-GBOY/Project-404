/** Every environment-driven constant the frontend needs, in one place. */
// Same-origin `/api` by default (the VPS nginx-fallback bundle, and local dev's
// Vite proxy). An absolute value is baked in at build time for a build served
// from a different origin than the API — e.g. Vercel — mirroring Mizan's own
// `VITE_API_BASE` (mizan/web/src/lib/api/http-client.ts).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "/api";
