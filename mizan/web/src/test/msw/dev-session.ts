import type { AuthUser, OrganizationMembership } from "@/types/auth";

/**
 * Session fixture for the **Vitest** MSW layer (`src/test/msw/`). The app has no
 * in-browser mock — this drives the auth + `/me` + notifications handlers used
 * by component/page tests only.
 */

export const DEV_USER: AuthUser = {
  id: "usr_dev",
  email: "mahmoud.nayel@tawfikpartners.eg",
  displayName: "Mahmoud Nayel",
  status: "active",
  emailVerified: true,
  locale: "ar",
};

export const DEV_ORGS: OrganizationMembership[] = [
  { organizationId: "org_tawfik", slug: "tawfik-partners", name: "Mizan", membershipRole: "firm_admin" },
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
