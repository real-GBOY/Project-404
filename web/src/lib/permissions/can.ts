/**
 * Permission matching — mirrors `permissionMatches` in Core
 * (`core/rbac/domain/permission.ts`). Key format is `action:resource`
 * (e.g. `create:matter`). `*` is a wildcard in either segment.
 *
 * ⚠ UX only. The backend is the security boundary — a hidden button is not a
 * protected endpoint.
 */
export function permissionMatches(held: string, action: string, resource: string): boolean {
  const [heldAction, heldResource] = held.split(":", 2);
  const actionOk = heldAction === "*" || heldAction === action;
  const resourceOk = heldResource === "*" || heldResource === resource;
  return actionOk && resourceOk;
}

export function createCan(permissions: readonly string[]) {
  const held = permissions;
  return function can(key: string): boolean {
    const [action, resource] = key.split(":", 2);
    if (!action || !resource) return false;
    return held.some((p) => permissionMatches(p, action, resource));
  };
}
