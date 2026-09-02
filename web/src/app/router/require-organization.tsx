import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOrganization } from "@/lib/tenant/use-organization";

/**
 * Inside the authenticated area but with no active tenant (an orgless token —
 * the user belongs to several orgs, or none). Bounce to the org selector,
 * remembering where they were headed.
 */
export function RequireOrganization() {
  const { organizationId } = useOrganization();
  const location = useLocation();

  if (!organizationId) {
    return (
      <Navigate
        to="/login/organization"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <Outlet />;
}
