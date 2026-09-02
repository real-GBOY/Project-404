import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { ForbiddenState } from "@/components/feedback/forbidden-state";

/**
 * Route-level permission gate. Renders `<ForbiddenState>` (never a blank screen)
 * when the active session lacks `perm`. UX only — the backend still enforces on
 * every request the page makes.
 */
export function RequirePermission({ perm, children }: { perm: string; children?: ReactNode }) {
  const { can } = usePermissions();
  if (!can(perm)) return <ForbiddenState />;
  return <>{children ?? <Outlet />}</>;
}
