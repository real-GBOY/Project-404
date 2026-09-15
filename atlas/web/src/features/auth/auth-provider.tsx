import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, setSessionExpiredHandler } from "@/lib/api/client";
import { getRefreshToken, setTokens } from "@/lib/api/token-store";
import type { AuthUser, LoginResponse, MeResponse } from "@/lib/api/auth-types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  organizationId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const INITIAL: AuthState = { status: "loading", user: null, organizationId: null };
const SIGNED_OUT: AuthState = { status: "unauthenticated", user: null, organizationId: null };

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session lives here: a persisted refresh token (see `lib/api/token-store.ts`)
 * is exchanged for a fresh access token + `/me` on boot, so a page reload
 * doesn't force a re-login. `client.ts`'s `apiFetch` calls
 * `setSessionExpiredHandler` back into this provider so an unrecoverable 401
 * anywhere in the app (not just a failed login) drops the user back to
 * `/login`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  const loadMe = useCallback(async () => {
    try {
      const me = await apiFetch<MeResponse>("/me");
      setState({ status: "authenticated", user: me.user, organizationId: me.organizationId });
    } catch {
      setTokens(null);
      setState(SIGNED_OUT);
    }
  }, []);

  useEffect(() => {
    if (getRefreshToken()) void loadMe();
    else setState(SIGNED_OUT);
  }, [loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => setState(SIGNED_OUT));
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(res.tokens);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();
    setTokens(null);
    setState(SIGNED_OUT);
    if (refreshToken) {
      apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => {
        /* best-effort — the client-side session is already cleared */
      });
    }
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
