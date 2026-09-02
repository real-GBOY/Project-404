/** Auth + session contract shapes (backend `core/identity`). */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  status: "active" | "pending" | "disabled";
  emailVerified: boolean;
  locale: string | null;
}

export interface OrganizationMembership {
  organizationId: string;
  slug: string;
  name: string;
  membershipRole: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginResponse {
  user: AuthUser;
  tokens: TokenPair;
  organizations: OrganizationMembership[];
}

/** Decoded access-token claims (HS256, `core/identity/infrastructure/jwt-service`). */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  /** Active tenant, or null for an orgless token. */
  org: string | null;
  /** Permission keys `action:resource` held in `org`. */
  perms: string[];
  exp: number;
  iat: number;
}

/** `GET /api/me`. */
export interface MeResponse {
  user: AuthUser;
  organizationId: string | null;
  permissions: string[];
}
