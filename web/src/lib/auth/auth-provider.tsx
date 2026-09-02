import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { httpClient } from "@/lib/api/http-client";
import type { AuthUser, MeResponse, OrganizationMembership } from "@/types/auth";
import { authEvents } from "./auth-events";
import { tokenStore } from "./token-store";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);

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
      setUser(null);
      setStatus("anon");
    }
  }, []);

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
    setUser(null);
    setMemberships([]);
    setStatus("anon");
    navigate("/login", { replace: true });
  }, [navigate]);

  const setSession = useCallback((nextUser: AuthUser, nextMemberships: OrganizationMembership[]) => {
    setUser(nextUser);
    setMemberships(nextMemberships);
    setStatus("authed");
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    return authEvents.on("logout", () => {
      tokenStore.clear();
      setUser(null);
      setStatus("anon");
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, memberships, setSession, refreshMe, logout }),
    [status, user, memberships, setSession, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
