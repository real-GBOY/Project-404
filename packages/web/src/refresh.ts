import type { TokenPair, TokenStoreCore } from "./token-store.js";

/**
 * Refresh tokens rotate server-side (single-use); presenting an already-rotated one revokes the
 * whole session as theft detection. A page with several queries in flight gets several
 * concurrent 401s, so every caller must share ONE in-flight refresh — otherwise all but the
 * first lose the race and take the user's session down with them.
 *
 * `exchange` performs the actual network call and MUST NOT go through the authenticated client
 * (a failed refresh must not re-trigger refresh). Return `null` when the refresh is rejected.
 */
export function createRefresher(options: {
  tokens: TokenStoreCore;
  exchange: (refreshToken: string) => Promise<TokenPair | null>;
  onRefreshed?: () => void;
}): () => Promise<boolean> {
  let inFlight: Promise<boolean> | null = null;

  return () => {
    inFlight ??= (async () => {
      const refreshToken = options.tokens.getRefresh();
      if (!refreshToken) return false;
      try {
        const pair = await options.exchange(refreshToken);
        if (!pair) return false;
        options.tokens.set(pair.accessToken, pair.refreshToken);
        options.onRefreshed?.();
        return true;
      } catch {
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
