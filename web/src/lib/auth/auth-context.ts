import { createContext } from "react";
import type { AuthUser, OrganizationMembership } from "@/types/auth";

export type AuthStatus = "loading" | "authed" | "anon";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** All orgs the user belongs to (from the last login). */
  memberships: OrganizationMembership[];
  setSession: (user: AuthUser, memberships: OrganizationMembership[]) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
