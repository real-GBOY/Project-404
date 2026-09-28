/**
 * Client-side permission matching for UX only (what to show). The backend's PermissionGuard is
 * the security boundary; this mirrors Core's `action:resource` semantics, including the `*`
 * wildcard on either side (`core/rbac/domain/permission.ts`).
 */
export function hasPermission(held: readonly string[], required: string): boolean {
  const [action, resource] = required.split(":");
  return held.some((key) => {
    const [heldAction, heldResource] = key.split(":");
    return (
      (heldAction === "*" || heldAction === action) &&
      (heldResource === "*" || heldResource === resource)
    );
  });
}
