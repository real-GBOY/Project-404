import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { Me, SecurityStatus } from "@/api/types";
import { isNetworkError } from "@/services/offline/outbox";
import { offline } from "@/services/offline/session";
import { useSyncState } from "@/hooks/use-sync-state";
import { ApiError, setSessionExpiredHandler, tokenStore } from "@/services/http";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./auth-context";
import { useIdleSignout } from "./use-idle-signout";

/**
 * Session state. A persisted refresh token is exchanged for a fresh access token + `/raqib/me` on boot, so a reload keeps the
 * session; an unrecoverable 401 anywhere drops back to the sign-in page via `setSessionExpiredHandler`. The authenticated
 * user (role, scope, permissions) always comes from the backend; nothing here decides what is allowed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const queryClient = useQueryClient();

  const refreshSecurity = useCallback(async () => {
    try {
      setSecurity(await api.account.security());
    } catch {
      setSecurity(null);
    }
  }, []);

  /** True while the identity on screen came from this device's copy because the server could not be reached. */
  const fromDevice = useRef(false);

  const loadMe = useCallback(async () => {
    try {
      const m = await api.me();
      fromDevice.current = false;
      setMe(m);
      setError(null);
      setStatus("authenticated");
      void offline.rememberSession(m);
      void refreshSecurity();
    } catch (e) {
      if (isNetworkError(e)) {
        // No connection is not a sign-out: keep the session, and open the app from the identity this device last saw.
        offline.reportNetworkFailure();
        const known = tokenStore.getRefresh() ? await offline.recallSession<Me>() : undefined;
        if (known) {
          fromDevice.current = true;
          setMe(known);
          setError(null);
          setStatus("authenticated");
          return;
        }
        setMe(null);
        setError("offline");
        setStatus("unauthenticated");
        throw e;
      }
      tokenStore.clear();
      setMe(null);
      setError(e instanceof ApiError ? e.code : "network");
      setStatus("unauthenticated");
      throw e;
    }
  }, [refreshSecurity]);

  // opened from the device copy while offline: read the real identity as soon as the connection returns
  const online = useSyncState().online;
  useEffect(() => {
    if (online && fromDevice.current) void loadMe().catch(() => undefined);
  }, [online, loadMe]);

  useEffect(() => {
    if (tokenStore.getRefresh()) void loadMe().catch(() => undefined);
    else setStatus("unauthenticated");
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setMe(null);
      setSecurity(null);
      setError("session_expired");
      setStatus("unauthenticated");
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string, otp?: string) => {
      const res = await api.auth.login(email, password, otp);
      // A new person at a shared desk must never see the previous user's cached data.
      queryClient.clear();
      tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      await loadMe();
    },
    [loadMe, queryClient],
  );

  const logout = useCallback(
    (reason?: string) => {
      const refreshToken = tokenStore.getRefresh();
      // the next person at this device must not find the last one's cached inspections (unsent changes stay queued for their owner)
      void Promise.all([offline.clearCache(), offline.forgetSession()]).finally(
        () => void offline.setUser(null),
      );
      tokenStore.clear();
      queryClient.clear();
      setMe(null);
      setSecurity(null);
      setError(reason ?? null);
      setStatus("unauthenticated");
      if (refreshToken) api.auth.logout(refreshToken).catch(() => undefined);
    },
    [queryClient],
  );

  useIdleSignout(status, security?.sessionMinutes ?? 0, () => logout("session_idle"));

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      error,
      security,
      refreshSecurity,
      login,
      logout,
      can: (m, l) => !!me?.permissions[m]?.includes(l),
    }),
    [status, me, error, security, refreshSecurity, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
