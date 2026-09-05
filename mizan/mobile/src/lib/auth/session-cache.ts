import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OrganizationMembership } from "@/types/auth";

/**
 * `GET /api/me` doesn't return the user's org memberships (only the active
 * one), so the org switcher would empty out after a reload. Cache the list
 * from the last login — org names/slugs, nothing sensitive, so plain
 * AsyncStorage (not SecureStore) is fine here, same choice as web's
 * localStorage. Ported from mizan/web/src/lib/auth/session-cache.ts.
 */
const KEY = "mizan.memberships";

export const sessionCache = {
  async getMemberships(): Promise<OrganizationMembership[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as OrganizationMembership[]) : [];
    } catch {
      return [];
    }
  },

  async setMemberships(memberships: OrganizationMembership[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(memberships));
    } catch {
      /* ignore */
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
