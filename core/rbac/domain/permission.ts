/**
 * A permission is an (action, resource) pair. Its canonical key is
 * "action:resource" (e.g. "employee:create"). Modules declare the
 * permissions they introduce (§3.2) and the RBAC registry seeds them.
 */
export interface PermissionDefinition {
  action: string;
  resource: string;
  description?: string;
}

export function permissionKey(action: string, resource: string): string {
  return `${action}:${resource}`;
}

export function parsePermissionKey(key: string): { action: string; resource: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0 || idx === key.length - 1) return null;
  return { action: key.slice(0, idx), resource: key.slice(idx + 1) };
}

/** Wildcards: "*:*" is superuser, "employee:*" is all actions on employee. */
export function permissionMatches(held: string, action: string, resource: string): boolean {
  const [heldAction, heldResource] = held.split(":", 2);
  const actionOk = heldAction === "*" || heldAction === action;
  const resourceOk = heldResource === "*" || heldResource === resource;
  return actionOk && resourceOk;
}
