import { tokenStore } from "@/lib/auth/token-store";
import type { AuthUser, OrganizationMembership } from "@/types/auth";

/**
 * Local dev session shim (F2). Auth + `/me` are real backend endpoints (PLAN §5)
 * — this only exists so the shell is usable before F3's login UI and while no
 * backend is running locally. It is inert when `VITE_API_MOCKS=off`. Delete the
 * seeding call once the real login flow + a reachable backend are in place.
 */

export const DEV_USER: AuthUser = {
  id: "usr_dev",
  email: "amira.tawfik@tawfikpartners.eg",
  displayName: "Amira Tawfik",
  status: "active",
  emailVerified: true,
  locale: "ar",
};

export const DEV_ORGS: OrganizationMembership[] = [
  { organizationId: "org_tawfik", slug: "tawfik-partners", name: "Tawfik & Partners", membershipRole: "firm_admin" },
  { organizationId: "org_demo", slug: "demo", name: "Demo Firm", membershipRole: "partner" },
];

/** Broad set — edit to exercise permission gating in the shell. */
export const DEV_PERMS: string[] = [
  "read:dashboard",
  "read:client",
  "read:matter",
  "read:hearing",
  "read:document",
  "read:invoice",
  "read:payment",
  "read:expense",
  "read:staff",
  "read:lawfirm_setting",
  "read:role",
  "read:audit_log",
  "create:client",
  "create:matter",
  "record:payment",
  "void:invoice",
];

function base64Url(json: unknown): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A structurally-valid (unsigned) access token `tokenStore.getClaims()` can decode. */
export function makeDevAccessToken(organizationId = DEV_ORGS[0].organizationId): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "none", typ: "JWT" });
  const payload = base64Url({
    sub: DEV_USER.id,
    email: DEV_USER.email,
    org: organizationId,
    perms: DEV_PERMS,
    iat: now,
    exp: now + 60 * 60,
  });
  return `${header}.${payload}.dev`;
}

export const DEV_REFRESH_TOKEN = "dev-refresh-token";

/** Put a dev session into the token store so `AuthProvider` bootstraps as authed. */
export function seedDevSession(): void {
  if (tokenStore.getRefresh()) return; // respect an existing session
  tokenStore.set(makeDevAccessToken(), DEV_REFRESH_TOKEN);
}
