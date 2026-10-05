import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/raqib";
import type { Me, ModuleKey } from "@/api/types";
import { ApiError, setSessionExpiredHandler, tokenStore } from "@/config";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  /** Why the last sign-in/me call failed, for the sign-in page (e.g. a disabled account). */
  error: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  /** UX only: the backend enforces every permission. */
  can(module: ModuleKey, letter: string): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/**
 * Session state. A persisted refresh token is exchanged for a fresh access token + `/raqib/me` on boot,
 * so a reload keeps the session; an unrecoverable 401 anywhere drops back to the sign-in page via
 * `setSessionExpiredHandler`. The authenticated user — role, scope, permissions — always comes from the
 * backend; nothing here decides what is allowed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
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
    if (tokenStore.getRefresh()) void loadMe().catch(() => undefined);
    else setStatus("unauthenticated");
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setMe(null);
      setError("session_expired");
      setStatus("unauthenticated");
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login(email, password);
      // A new person at a shared desk must never see the previous user's cached data.
      queryClient.clear();
      tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      await loadMe();
    },
    [loadMe, queryClient],
  );

  const logout = useCallback(() => {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    queryClient.clear();
    setMe(null);
    setError(null);
    setStatus("unauthenticated");
    if (refreshToken) api.auth.logout(refreshToken).catch(() => undefined);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, me, error, login, logout, can: (m, l) => !!me?.permissions[m]?.includes(l) }),
    [status, me, error, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
