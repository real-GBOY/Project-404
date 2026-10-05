import { createHttpClient, ApiError } from "@auric/web";
import { API_BASE_URL } from "./env";
import { ENDPOINTS } from "./endpoints";
import { tokenStore } from "./token-store";

export { ApiError };

/** Set once by `AuthProvider`; called when a request cannot be recovered by refreshing. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

/**
 * The one HTTP client every `src/api/*` file calls through — `@auric/web`'s fetch transport
 * (bearer auth, a single shared refresh on 401, `{ error: { code, message } }` → `ApiError`).
 */
export const http = createHttpClient({
  baseUrl: API_BASE_URL,
  tokens: tokenStore,
  refreshPath: ENDPOINTS.auth.refresh,
  onLogout: () => onSessionExpired?.(),
});
