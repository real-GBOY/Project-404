import type { OrganizationMembership } from "@/types/auth";

/**
 * `GET /api/me` doesn't return the user's org memberships (only the active one),
 * so the org switcher would empty out after a reload. We cache the list from the
 * last login next to the refresh token — org names/slugs, nothing sensitive.
 */
const KEY = "mizan.memberships";

export const sessionCache = {
  getMemberships(): OrganizationMembership[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as OrganizationMembership[]) : [];
    } catch {
      return [];
    }
  },

  setMemberships(memberships: OrganizationMembership[]): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(memberships));
    } catch {
      /* private mode / disabled storage */
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
