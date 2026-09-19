import { createHttpClient, type RequestOptions } from "@auric/web";
import { tokenStore } from "@/lib/auth/token-store";
import { authEvents } from "@/lib/auth/auth-events";

export type { RequestOptions };

export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
/** An absolute base (Vercel → VPS) must survive into the request URL; a relative
 *  one (`/api` — dev proxy, tests, the VPS-served bundle) stays same-origin. */
export const API_BASE_IS_ABSOLUTE = /^https?:\/\//i.test(API_BASE);

/**
 * The single entry point for API calls. The transport — bearer auth, single-flight refresh,
 * one retry on 401, non-2xx → `ApiError` — is `@auric/web`'s; this file binds it to Mizan's
 * token store and auth events.
 */
export const httpClient = createHttpClient({
  baseUrl: API_BASE,
  tokens: tokenStore,
  refreshPath: "/auth/refresh",
  onRefreshed: () => authEvents.emit("tokens-refreshed"),
  onLogout: () => authEvents.emit("logout"),
});

/** Prefix an API path (`/documents`) with the configured base. Absolute URLs pass through. */
export const withApiBase = httpClient.withApiBase;

/** `{ Authorization }` for the current access token, or `{}` when signed out. */
export const bearerHeaders = httpClient.bearerHeaders;
