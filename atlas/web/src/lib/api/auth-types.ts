export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number; tokenType: string };
  organizations: Array<{ organizationId: string; slug: string; name: string; membershipRole: string }>;
}

export interface MeResponse {
  user: AuthUser;
  organizationId: string | null;
  permissions: string[];
}
