import { createContext } from "react";
import type { OrganizationMembership } from "@/types/auth";

export interface TenantContextValue {
  /** The active organization id (from the access-token `org` claim), or null. */
  organizationId: string | null;
  organization: OrganizationMembership | null;
  organizations: OrganizationMembership[];
  switchTo: (organizationId: string) => Promise<void>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);
