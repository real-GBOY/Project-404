import { useContext } from "react";
import { TenantContext, type TenantContextValue } from "./tenant-context";

export function useOrganization(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useOrganization must be used within <TenantProvider>");
  return ctx;
}
