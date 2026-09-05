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
  /** All orgs the user belongs to (from the last login, cached across restarts). */
  memberships: OrganizationMembership[];
  /** Bumps on every token change (login, org switch, silent refresh) so
   *  permission derivations re-run. */
  sessionVersion: number;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Mint an access token scoped to `organizationId` and make it active. */
  selectOrganization: (organizationId: string) => Promise<void>;
  setSession: (user: AuthUser, memberships: OrganizationMembership[]) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  /**
   * There is no backend biometric endpoint (confirmed) — this gates *local*
   * access to the already-stored refresh token behind the device's Face
   * ID/fingerprint, then completes the same session bootstrap `refreshMe`
   * would. Returns whether it ended in an authed session.
   */
  unlockWithBiometrics: () => Promise<boolean>;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Whether a refresh token is on this device from a previous sign-in — used
   *  to offer "Use Face ID instead" on the sign-in screen. */
  hasStoredSession: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
