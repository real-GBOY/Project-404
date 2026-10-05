import { createContext, useContext } from "react";
import type { Me, ModuleKey, SecurityStatus } from "@/api/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  me: Me | null;
  /** Why the last sign-in/me call failed (or why the person was signed out), for the sign-in page. */
  error: string | null;
  /** The signed-in person's account-security state (second factor, password age, session rule); null until loaded. */
  security: SecurityStatus | null;
  refreshSecurity(): Promise<void>;
  login(email: string, password: string, otp?: string): Promise<void>;
  logout(reason?: string): void;
  /** UX only: the backend enforces every permission. */
  can(module: ModuleKey, letter: string): boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
