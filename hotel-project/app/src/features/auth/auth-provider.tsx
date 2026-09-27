import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ENDPOINTS, http, setSessionExpiredHandler, tokenStore } from "@/config";
import { hasPermission } from "@/lib/permissions";
import type { LoginResponse, MeResponse } from "./auth-types";
import { AuthContext, type AuthContextValue, type AuthState } from "./use-auth";

const INITIAL: AuthState = { status: "loading", user: null, organizationId: null, permissions: [] };
const SIGNED_OUT: AuthState = {
  status: "unauthenticated",
  user: null,
  organizationId: null,
  permissions: [],
};

/**
 * Session state (atlas/web's shape, on `@auric/web`'s fetch client). A persisted refresh token is
 * exchanged for a fresh access token + `/me` on boot, so a reload doesn't force a re-login; an
 * unrecoverable 401 anywhere drops the user back to `/login` via `setSessionExpiredHandler`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  const loadMe = useCallback(async () => {
    try {
      const me = await http<MeResponse>(ENDPOINTS.me);
      setState({
        status: "authenticated",
        user: me.user,
        organizationId: me.organizationId,
        permissions: me.permissions,
      });
    } catch {
      tokenStore.clear();
      setState(SIGNED_OUT);
    }
  }, []);

  useEffect(() => {
    if (tokenStore.getRefresh()) void loadMe();
    else setState(SIGNED_OUT);
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => setState(SIGNED_OUT));
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await http<LoginResponse>(ENDPOINTS.auth.login, {
        method: "POST",
        body: { email, password },
        anonymous: true,
      });
      tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    const refreshToken = tokenStore.getRefresh();
    tokenStore.clear();
    setState(SIGNED_OUT);
    if (refreshToken) {
      http(ENDPOINTS.auth.logout, {
        method: "POST",
        body: { refreshToken },
        anonymous: true,
      }).catch(() => {
        /* best-effort — the client-side session is already cleared */
      });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      can: (permission) => hasPermission(state.permissions, permission),
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
