/** Every environment-driven constant the app needs, in one place. */

// Same-origin `/api` by default (Vite dev proxy locally; nginx in front of the API on the VPS). An absolute URL is baked in at
// build time when the app is served from another origin (the `VITE_API_BASE` convention shared with the other products' web apps).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE ?? "/api";

/** The organizer whose site `/` opens. Any other organizer is reached at `/e/<slug>`. */
export const DEFAULT_ORG: string = import.meta.env.VITE_ORG_SLUG ?? "nile-sessions";

/** Demo deployments show the demo accounts on the organizer sign-in page. */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO === "true" || import.meta.env.DEV;
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD ?? "demo-password-2026";

/** Time zone dates are shown in (v1 is single-timezone; the backend formats emails in the organizer's setting). */
export const TIME_ZONE = "Africa/Cairo";

/** The picture a ticket QR link (`/q/<token>`) shows when scanned with an ordinary phone camera. Hosted, so it works on any deployment. */
export const QR_LANDING_IMAGE: string =
  import.meta.env.VITE_QR_LANDING_IMAGE ??
  "https://i.postimg.cc/cCvLrpyG/Whats-App-Image-2026-10-10-at-2-27-41-PM.jpg";
