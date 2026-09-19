/**
 * Token storage. The access token lives in memory only; the refresh token is persisted so a
 * page reload can re-establish the session.
 *
 * âš  Refresh-in-localStorage is exposed to XSS â€” move to an httpOnly cookie once the backend
 * sets one.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenStore {
  getAccess(): string | null;
  getRefresh(): string | null;
  /** Decode the access token's JWT payload (client-side convenience only â€” the server is the authority). */
  getClaims<T = Record<string, unknown>>(): T | null;
  set(access: string, refresh: string): void;
  setAccess(access: string): void;
  clear(): void;
}

/** What the transport needs from a store — claims decoding is the app's business. */
export type TokenStoreCore = Pick<TokenStore, "getAccess" | "getRefresh" | "set" | "clear">;

export interface TokenStoreOptions {
  /** localStorage key for the refresh token â€” per product, so two apps on one origin never collide. */
  refreshKey: string;
  /** Defaults to `globalThis.localStorage` when available. */
  storage?: KeyValueStorage;
}

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return (globalThis as { localStorage?: KeyValueStorage }).localStorage;
  } catch {
    return undefined;
  }
}

export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as T;
  } catch {
    return null;
  }
}

export function createTokenStore(options: TokenStoreOptions): TokenStore {
  const { refreshKey } = options;
  const storage = (): KeyValueStorage | undefined => options.storage ?? defaultStorage();
  let accessToken: string | null = null;
  // Fallback for when storage is unavailable (private mode): the session then still works for
  // this tab. Storage stays the source of truth whenever it answers.
  let memoryRefresh: string | null = null;

  return {
    getAccess: () => accessToken,
    getRefresh: () => {
      try {
        return storage()?.getItem(refreshKey) ?? memoryRefresh;
      } catch {
        return memoryRefresh;
      }
    },
    getClaims: <T>() => (accessToken ? decodeJwtPayload<T>(accessToken) : null),
    set: (access, refresh) => {
      accessToken = access;
      memoryRefresh = refresh;
      try {
        storage()?.setItem(refreshKey, refresh);
      } catch {
        /* private mode / disabled storage â€” the session won't survive a reload */
      }
    },
    setAccess: (access) => {
      accessToken = access;
    },
    clear: () => {
      accessToken = null;
      memoryRefresh = null;
      try {
        storage()?.removeItem(refreshKey);
      } catch {
        /* ignore */
      }
    },
  };
}
