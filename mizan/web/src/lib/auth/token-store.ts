import type { AccessTokenClaims } from "@/types/auth";

/**
 * Token storage. Access token lives in memory only; refresh token in
 * `localStorage` so a page reload can re-establish the session.
 *
 * ⚠ Hardening item (PLAN §6): refresh-in-localStorage is exposed to XSS. Move to
 * an httpOnly cookie once the backend sets one.
 */
const REFRESH_KEY = "mizan.refresh";

let accessToken: string | null = null;

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
  getAccess: (): string | null => accessToken,

  getClaims: (): AccessTokenClaims | null =>
    accessToken ? decodeClaims(accessToken) : null,

  getRefresh: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  set: (access: string, refresh: string): void => {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* private mode / disabled storage — session won't survive reload */
    }
  },

  setAccess: (access: string): void => {
    accessToken = access;
  },

  clear: (): void => {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};
