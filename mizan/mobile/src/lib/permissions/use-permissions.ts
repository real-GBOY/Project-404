import { useMemo } from "react";
import { tokenStore } from "@/lib/auth/token-store";
import { useAuth } from "@/lib/auth/use-auth";
import { createCan } from "./can";

export interface Permissions {
  /** `can("create:matter")` — UX gating only; the backend enforces. */
  can: (key: string) => boolean;
  /** every permission key held in the active tenant */
  keys: string[];
}

/** Ported from mizan/web/src/lib/permissions/use-permissions.ts. */
export function usePermissions(): Permissions {
  // Re-derive on every token change (login / silent refresh / org switch).
  const { status, sessionVersion } = useAuth();

  return useMemo<Permissions>(() => {
    void status;
    void sessionVersion;
    const keys = tokenStore.getClaims()?.perms ?? [];
    return { can: createCan(keys), keys };
  }, [status, sessionVersion]);
}
