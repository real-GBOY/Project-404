import { createContext, useContext } from "react";
import type { AuthUser } from "./auth-types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  organizationId: string | null;
  permissions: string[];
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** UX-only permission check (hide what the user can't do). The backend enforces. */
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Session state from `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
