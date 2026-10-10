import { createHttpClient, ApiError } from "@auric/web";
import { API_BASE_URL } from "@/config/env";
import { ENDPOINTS } from "@/config/endpoints";
import { tokenStore } from "./token-store";

export { ApiError, tokenStore };

/** Set once by `AuthProvider`; called when a request cannot be recovered by refreshing. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/**
 * The one HTTP client every `src/api/*` file calls through - `@auric/web`'s fetch transport (bearer auth, a single shared
 * refresh on 401, `{ error: { code, message } }` -> `ApiError`). Public (customer) calls pass `anonymous: true`.
 */
export const http = createHttpClient({
  baseUrl: API_BASE_URL,
  tokens: tokenStore,
  refreshPath: ENDPOINTS.auth.refresh,
  onLogout: () => onSessionExpired?.(),
});

/** An API-served asset path such as `/api/admit/public/.../qr.png?k=`, made absolute when the API lives on another origin than the page. */
export function assetUrl(path: string): string {
  return /^https?:\/\//i.test(path) || !/^https?:\/\//i.test(API_BASE_URL) ? path : new URL(API_BASE_URL).origin + path;
}
