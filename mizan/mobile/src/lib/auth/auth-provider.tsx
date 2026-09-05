import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { httpClient } from "@/lib/api/http-client";
import * as authApi from "./auth-endpoints";
import type { AuthUser, MeResponse, OrganizationMembership } from "@/types/auth";
import { authEvents } from "./auth-events";
import { tokenStore } from "./token-store";
import { sessionCache } from "./session-cache";
import { AuthContext, type AuthContextValue, type AuthStatus, type LoginOutcome } from "./auth-context";

const BIOMETRIC_KEY = "mizan.biometric-enabled";

/**
 * Ported from mizan/web/src/lib/auth/auth-provider.tsx, adapted for native:
 * SecureStore-backed tokens (async), expo-router instead of react-router, and
 * a biometric unlock layer with no web equivalent (see auth-context.ts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const bump = useCallback(() => setSessionVersion((v) => v + 1), []);

  const refreshMe = useCallback(async () => {
    const [access, refresh] = [tokenStore.getAccess(), await tokenStore.getRefresh()];
    if (!access && !refresh) {
      setStatus("anon");
      return;
    }
    try {
      const me = await httpClient<MeResponse>("/me");
      setUser(me.user);
      setStatus("authed");
    } catch {
      await tokenStore.clear();
      await sessionCache.clear();
      setUser(null);
      setMemberships([]);
      setStatus("anon");
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const res = await authApi.login({ email, password });
      await tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
      await sessionCache.setMemberships(res.organizations);
      setUser(res.user);
      setMemberships(res.organizations);
      setHasStoredSession(true);
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
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) throw new Error("No session");
      const { tokens } = await authApi.refresh(refreshToken, organizationId);
      await tokenStore.set(tokens.accessToken, tokens.refreshToken);
      bump();
      await refreshMe();
    },
    [bump, refreshMe],
  );

  const logout = useCallback(async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (refreshToken) {
      await httpClient("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        anonymous: true,
      }).catch(() => undefined);
    }
    await tokenStore.clear();
    await sessionCache.clear();
    setUser(null);
    setMemberships([]);
    setHasStoredSession(false);
    setStatus("anon");
    router.replace("/(auth)/sign-in");
  }, []);

  const setSession = useCallback(
    (nextUser: AuthUser, nextMemberships: OrganizationMembership[]) => {
      setUser(nextUser);
      setMemberships(nextMemberships);
      void sessionCache.setMemberships(nextMemberships);
      setStatus("authed");
      bump();
    },
    [bump],
  );

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    try {
      await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  /** No backend biometric endpoint exists — this only gates local access to
   *  the refresh token already on the device, then runs the same bootstrap. */
  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Mizan",
        fallbackLabel: "Use password instead",
      });
      if (!result.success) return false;
    } catch {
      return false;
    }
    await refreshMe();
    return true;
  }, [refreshMe]);

  useEffect(() => {
    void (async () => {
      await tokenStore.hydrate();
      const [refresh, hardware, enrolled, storedPref, cachedMemberships] = await Promise.all([
        tokenStore.getRefresh(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        AsyncStorage.getItem(BIOMETRIC_KEY).catch(() => null),
        sessionCache.getMemberships(),
      ]);
      setHasStoredSession(!!refresh);
      setMemberships(cachedMemberships);
      const available = hardware && enrolled;
      setBiometricAvailable(available);
      // Default on when hardware supports it and the user hasn't chosen yet.
      setBiometricEnabledState(storedPref === null ? available : storedPref === "1");
      await refreshMe();
    })();
  }, [refreshMe]);

  // Silent refresh happened inside httpClient — re-derive permissions.
  useEffect(() => authEvents.on("tokens-refreshed", bump), [bump]);

  useEffect(() => {
    return authEvents.on("logout", () => {
      void tokenStore.clear();
      void sessionCache.clear();
      setUser(null);
      setMemberships([]);
      setHasStoredSession(false);
      setStatus("anon");
      router.replace("/(auth)/sign-in");
    });
  }, []);

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
      unlockWithBiometrics,
      biometricEnabled,
      biometricAvailable,
      setBiometricEnabled,
      hasStoredSession,
    }),
    [
      status,
      user,
      memberships,
      sessionVersion,
      login,
      selectOrganization,
      setSession,
      refreshMe,
      logout,
      unlockWithBiometrics,
      biometricEnabled,
      biometricAvailable,
      setBiometricEnabled,
      hasStoredSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
