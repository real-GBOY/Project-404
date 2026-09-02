import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import { Unauthenticated } from "@core/kernel/errors.js";
import type { Principal, RequestWithPrincipal } from "./principal.js";

/** The authenticated caller (set by `JwtAuthGuard`). Throws 401 if absent. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!req.principal) throw Unauthenticated();
    return req.principal;
  },
);

export const PERMISSION_KEY = "auric:permission";

/**
 * Require an RBAC permission on a route, checked live against the active tenant
 * by `PermissionGuard` (which runs after `JwtAuthGuard`).
 *
 *   @RequirePermission("update", "organization")
 */
export const RequirePermission = (action: string, resource: string) =>
  SetMetadata(PERMISSION_KEY, { action, resource });
