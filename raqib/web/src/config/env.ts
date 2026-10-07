/** Every environment-driven constant the app needs, in one place. */

// Same-origin `/api` by default (Vite dev proxy locally; nginx in front of the API on the VPS).
// An absolute URL is baked in at build time when served from another origin (the `VITE_API_BASE`
// convention shared with mizan/web, atlas/web and hotel-project/app).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "/api";

/** Demo deployments show the role switcher and the demo accounts on the sign-in page. */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO === "true" || import.meta.env.DEV;
/**
 * Client-demo scope (VITE_DEMO_SCOPE=client): shows only the inspection story (schedule, inspections, review, reports, corrective
 * actions, observations, forms, analytics) and hides administration, confidential reports, training and guards. Presentation only:
 * the backend enforces every route as before. Independent of DEMO_MODE, so the demo-account switcher stays available.
 */
export const DEMO_SCOPE: boolean = import.meta.env.VITE_DEMO_SCOPE === "client";
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? "demo-password-2026";

/** The organization whose public account-request page the sign-in page links to. */
export const ORG_SLUG: string = import.meta.env.VITE_ORG_SLUG ?? "raqib-demo";
