import type { ReactNode } from "react";
import { usePermissions } from "./use-permissions";

interface CanProps {
  /** `action:resource` — or an array; renders if ANY match (use `all` for every). */
  perm: string | string[];
  all?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render UI by permission. UX only — the backend still enforces.
 *
 *   <Can perm="void:invoice"><VoidButton /></Can>
 */
export function Can({ perm, all = false, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  const keys = Array.isArray(perm) ? perm : [perm];
  const ok = all ? keys.every(can) : keys.some(can);
  return <>{ok ? children : fallback}</>;
}
