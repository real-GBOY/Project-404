import * as SecureStore from "expo-secure-store";
import type { AccessTokenClaims } from "@/types/auth";

/**
 * Token storage — native analogue of mizan/web/src/lib/auth/token-store.ts.
 * Web keeps the access token in memory only and the refresh token in
 * localStorage (with a documented XSS caveat that doesn't apply on native).
 * On native there's no equivalent "in-memory across reloads" concern — the
 * process just restarts — so both tokens go in SecureStore (Keychain/
 * Keystore), which is the correct native equivalent of an httpOnly cookie.
 * The access token is additionally cached in a plain module variable for
 * synchronous reads between the (async) SecureStore round-trips.
 */
const ACCESS_KEY = "mizan.access";
const REFRESH_KEY = "mizan.refresh";

let accessTokenCache: string | null = null;
let hydrated = false;

/** Hermes (RN's JS engine) ships a global `atob`. */
function decodeClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export const tokenStore = {
  /** Synchronous — reads the in-memory cache, populated by `hydrate()`/`set()`. */
  getAccess: (): string | null => accessTokenCache,

  getClaims: (): AccessTokenClaims | null =>
    accessTokenCache ? decodeClaims(accessTokenCache) : null,

  getRefresh: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  /** Call once at app start before rendering anything that needs `getAccess()`. */
  hydrate: async (): Promise<void> => {
    if (hydrated) return;
    hydrated = true;
    try {
      accessTokenCache = await SecureStore.getItemAsync(ACCESS_KEY);
    } catch {
      accessTokenCache = null;
    }
  },

  set: async (access: string, refresh: string): Promise<void> => {
    accessTokenCache = access;
    try {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_KEY, access),
        SecureStore.setItemAsync(REFRESH_KEY, refresh),
      ]);
    } catch {
      /* device storage unavailable — session won't survive a restart */
    }
  },

  setAccess: async (access: string): Promise<void> => {
    accessTokenCache = access;
    try {
      await SecureStore.setItemAsync(ACCESS_KEY, access);
    } catch {
      /* ignore */
    }
  },

  clear: async (): Promise<void> => {
    accessTokenCache = null;
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
      ]);
    } catch {
      /* ignore */
    }
  },
};
