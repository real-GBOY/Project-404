/** Every environment-driven constant the app needs, in one place. */

// Same-origin `/api` by default (Vite dev proxy locally; nginx in front of the API on the VPS).
// An absolute URL is baked in at build time when served from another origin (the `VITE_API_BASE`
// convention shared with mizan/web, atlas/web and hotel-project/app).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "/api";

/** Demo deployments show the role switcher and the demo accounts on the sign-in page. */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO === "true" || import.meta.env.DEV;
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? "demo-password-2026";
