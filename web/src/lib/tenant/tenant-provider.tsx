import { useCallback, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "@/lib/auth/token-store";
import { useAuth } from "@/lib/auth/use-auth";
import { TenantContext, type TenantContextValue } from "./tenant-context";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { memberships, sessionVersion, selectOrganization } = useAuth();
  const queryClient = useQueryClient();

  // Recomputed each render; `sessionVersion` (bumped on every token change)
  // guarantees a render after login / silent refresh / org switch.
  void sessionVersion;
  const organizationId = tokenStore.getClaims()?.org ?? null;
  const organization = memberships.find((m) => m.organizationId === organizationId) ?? null;

  const switchTo = useCallback(
    async (nextOrgId: string) => {
      await selectOrganization(nextOrgId);
      await queryClient.invalidateQueries();
    },
    [selectOrganization, queryClient],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ organizationId, organization, organizations: memberships, switchTo }),
    [organizationId, organization, memberships, switchTo],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
