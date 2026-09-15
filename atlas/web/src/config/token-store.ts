/**
 * Plain (non-React) token storage — `http.ts`'s axios interceptors need to
 * read/write the current tokens outside of component render, so this lives
 * outside React state. `features/auth/auth-provider.tsx` wraps this in
 * reactive context for the UI. Only the refresh token is persisted (access
 * tokens are short-lived and re-derived from it on boot); this avoids ever
 * persisting long-lived secrets.
 */
const REFRESH_KEY = "atlas.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = readPersistedRefreshToken();

function readPersistedRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Pass `null` to clear the session (logout, or a refresh that failed). */
export function setTokens(tokens: TokenPair | null): void {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  try {
    if (tokens) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* private-browsing / storage disabled — session still works for this tab */
  }
}
