import { createContext } from "react";
import type { AuthUser, OrganizationMembership } from "@/types/auth";

export type AuthStatus = "loading" | "authed" | "anon";

export interface LoginOutcome {
  /** the session has no active tenant and the user must pick one */
  needsOrgSelection: boolean;
  /** the user belongs to no organization at all */
  hasNoOrg: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** All orgs the user belongs to (from the last login, cached across reloads). */
  memberships: OrganizationMembership[];
  /** Bumps on every token change (login, org switch, silent refresh) so
   *  permission + tenant derivations re-run. */
  sessionVersion: number;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Mint an access token scoped to `organizationId` and make it active. */
  selectOrganization: (organizationId: string) => Promise<void>;
  setSession: (user: AuthUser, memberships: OrganizationMembership[]) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
