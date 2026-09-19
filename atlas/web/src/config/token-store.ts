import { createTokenStore, type TokenPair } from "@auric/web";

export type { TokenPair };

/**
 * Plain (non-React) token storage — `http.ts`'s axios interceptors need to read/write the
 * current tokens outside of component render, so this lives outside React state.
 * `features/auth/auth-provider.tsx` wraps it in reactive context for the UI. Only the refresh
 * token is persisted (access tokens are short-lived and re-derived from it on boot).
 *
 * The mechanism is `@auric/web`'s; Atlas only names its storage key.
 */
export const tokenStore = createTokenStore({ refreshKey: "atlas.refreshToken" });

export function getAccessToken(): string | null {
  return tokenStore.getAccess();
}

export function getRefreshToken(): string | null {
  return tokenStore.getRefresh();
}

/** Pass `null` to clear the session (logout, or a refresh that failed). */
export function setTokens(tokens: TokenPair | null): void {
  if (tokens) tokenStore.set(tokens.accessToken, tokens.refreshToken);
  else tokenStore.clear();
}
