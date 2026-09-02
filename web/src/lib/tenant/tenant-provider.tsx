import { useCallback, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/lib/api/http-client";
import { tokenStore } from "@/lib/auth/token-store";
import { useAuth } from "@/lib/auth/use-auth";
import { TenantContext, type TenantContextValue } from "./tenant-context";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { memberships } = useAuth();
  const queryClient = useQueryClient();

  const organizationId = tokenStore.getClaims()?.org ?? null;
  const organization = memberships.find((m) => m.organizationId === organizationId) ?? null;

  const switchTo = useCallback(
    async (nextOrgId: string) => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) return;
      const data = await httpClient<{ tokens: { accessToken: string; refreshToken: string } }>(
        "/auth/refresh",
        { method: "POST", body: { refreshToken, organizationId: nextOrgId }, anonymous: true },
      );
      tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<TenantContextValue>(
    () => ({ organizationId, organization, organizations: memberships, switchTo }),
    [organizationId, organization, memberships, switchTo],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
