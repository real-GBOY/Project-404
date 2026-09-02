import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { httpClient } from "@/lib/api/http-client";
import * as authApi from "./auth-endpoints";
import type { AuthUser, MeResponse, OrganizationMembership } from "@/types/auth";
import { authEvents } from "./auth-events";
import { tokenStore } from "./token-store";
import { sessionCache } from "./session-cache";
import { AuthContext, type AuthContextValue, type AuthStatus, type LoginOutcome } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>(() =>
    sessionCache.getMemberships(),
  );
  const [sessionVersion, setSessionVersion] = useState(0);
  const bump = useCallback(() => setSessionVersion((v) => v + 1), []);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
      setStatus("anon");
      return;
    }
    try {
      const me = await httpClient<MeResponse>("/me");
      setUser(me.user);
      setStatus("authed");
    } catch {
      tokenStore.clear();
      sessionCache.clear();
      setUser(null);
      setMemberships([]);
      setStatus("anon");
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const res = await authApi.login({ email, password });
      tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      sessionCache.setMemberships(res.organizations);
      setUser(res.user);
      setMemberships(res.organizations);
      setStatus("authed");
      bump();
      const activeOrg = tokenStore.getClaims()?.org ?? null;
      return {
        needsOrgSelection: activeOrg === null && res.organizations.length > 0,
        hasNoOrg: res.organizations.length === 0,
      };
    },
    [bump],
  );

  const selectOrganization = useCallback(
    async (organizationId: string) => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) throw new Error("No session");
      const { tokens } = await authApi.refresh(refreshToken, organizationId);
      tokenStore.set(tokens.accessToken, tokens.refreshToken);
      bump();
      await refreshMe();
    },
    [bump, refreshMe],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh();
    if (refreshToken) {
      await httpClient("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        anonymous: true,
      }).catch(() => undefined);
    }
    tokenStore.clear();
    sessionCache.clear();
    setUser(null);
    setMemberships([]);
    setStatus("anon");
    navigate("/login", { replace: true });
  }, [navigate]);

  const setSession = useCallback(
    (nextUser: AuthUser, nextMemberships: OrganizationMembership[]) => {
      setUser(nextUser);
      setMemberships(nextMemberships);
      sessionCache.setMemberships(nextMemberships);
      setStatus("authed");
      bump();
    },
    [bump],
  );

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  // Silent refresh happened inside httpClient — re-derive tenant + permissions.
  useEffect(() => authEvents.on("tokens-refreshed", bump), [bump]);

  useEffect(() => {
    return authEvents.on("logout", () => {
      tokenStore.clear();
      sessionCache.clear();
      setUser(null);
      setMemberships([]);
      setStatus("anon");
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      memberships,
      sessionVersion,
      login,
      selectOrganization,
      setSession,
      refreshMe,
      logout,
    }),
    [status, user, memberships, sessionVersion, login, selectOrganization, setSession, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
