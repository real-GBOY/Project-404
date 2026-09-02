import type { AuthUser, OrganizationMembership } from "@/types/auth";

/**
 * Fixture data for the dev-only session shim (`mocks/handlers/session.ts`).
 * Auth + `/me` are real backend endpoints (PLAN §5); this exists only so the app
 * runs locally without a backend. Inert when `VITE_API_MOCKS=off`.
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

/** Broad set — trim it to exercise permission gating in the shell. */
export const DEV_PERMS: string[] = [
  "read:dashboard",
  "read:client", "create:client", "update:client", "archive:client",
  "read:matter", "create:matter", "update:matter", "close:matter", "assign:matter",
  "read:matter_note", "write:matter_note",
  "read:hearing", "schedule:hearing", "update:hearing",
  "read:task", "create:task", "update:task", "assign:task", "complete:task",
  "read:document", "upload:document", "update:document", "delete:document",
  "read:invoice", "create:invoice", "issue:invoice", "send:invoice", "void:invoice",
  "read:payment", "record:payment",
  "read:expense", "record:expense", "approve:expense",
  "read:staff", "manage:staff",
  "read:lawfirm_setting", "manage:lawfirm_setting",
  "read:calendar", "create:event", "update:event", "delete:event",
  "read:role", "assign:role",
  "read:audit_log",
];

function base64Url(json: unknown): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A structurally-valid (unsigned) access token `tokenStore.getClaims()` can decode. */
export function makeDevAccessToken(
  organizationId: string | null = DEV_ORGS[0].organizationId,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "none", typ: "JWT" });
  const payload = base64Url({
    sub: DEV_USER.id,
    email: DEV_USER.email,
    org: organizationId,
    perms: organizationId ? DEV_PERMS : [],
    iat: now,
    exp: now + 60 * 60,
  });
  return `${header}.${payload}.dev`;
}

export const DEV_REFRESH_TOKEN = "dev-refresh-token";
