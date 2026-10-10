import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminApi, authApi } from "@/api";
import type { Me } from "@/api/types";
import { ApiError, http, setSessionExpiredHandler, tokenStore } from "@/services/http";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthValue {
  status: AuthStatus;
  me: Me | null;
  /** Why the person is signed out (shown on the sign-in page). */
  error: string | null;
  login(email: string, password: string): Promise<void>;
  logout(reason?: string): void;
  /** UX only: the backend enforces every permission. Hide what a role can never do. */
  can(permission: string): boolean;
}

const Ctx = createContext<AuthValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/** Permission check with Core's wildcard rules ("*:*", "approve:*", "*:payment"). */
// eslint-disable-next-line react-refresh/only-export-components
export function hasPermission(held: string[], wanted: string): boolean {
  const [a, r] = wanted.split(":");
  return held.some((h) => {
    const [ha, hr] = h.split(":");
    return (ha === "*" || ha === a) && (hr === "*" || hr === r);
  });
}

/**
 * Session state for the organizer dashboard and scanner. A persisted refresh token is exchanged for a fresh access token plus
 * `/admit/me` on boot, so a reload keeps the session; an unrecoverable 401 anywhere drops back to the sign-in page. The person, their
 * permissions and their event reach always come from the backend; nothing here decides what is allowed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const loadMe = useCallback(async () => {
    try {
      const m = await adminApi.me();
      setMe(m);
      setError(null);
      setStatus("authenticated");
    } catch (e) {
      tokenStore.clear();
      setMe(null);
      setError(e instanceof ApiError ? e.code : "network");
      setStatus("unauthenticated");
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!tokenStore.getRefresh()) return void setStatus("unauthenticated");
    void (async () => {
      if (!tokenStore.getAccess()) await http.refresh().catch(() => undefined);
      await loadMe().catch(() => undefined);
    })();
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      qc.clear();
      setMe(null);
      setError("session_expired");
      setStatus("unauthenticated");
    });
    return () => setSessionExpiredHandler(null);
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      qc.clear(); // a new person at a shared desk must never see the previous person's cached data
      tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      await loadMe();
    },
    [loadMe, qc],
  );

  const logout = useCallback(
    (reason?: string) => {
      const refresh = tokenStore.getRefresh();
      tokenStore.clear();
      qc.clear();
      setMe(null);
      setError(reason ?? null);
      setStatus("unauthenticated");
      if (refresh) authApi.logout(refresh).catch(() => undefined);
    },
    [qc],
  );

  const value = useMemo<AuthValue>(() => ({ status, me, error, login, logout, can: (p) => !!me && hasPermission(me.permissions, p) }), [status, me, error, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
