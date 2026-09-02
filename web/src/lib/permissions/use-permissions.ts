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

export function usePermissions(): Permissions {
  // Re-derive whenever auth status changes (login / refresh / org switch).
  const { status } = useAuth();

  return useMemo<Permissions>(() => {
    void status;
    const keys = tokenStore.getClaims()?.perms ?? [];
    return { can: createCan(keys), keys };
  }, [status]);
}
