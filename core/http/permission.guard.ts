import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Forbidden, Unauthenticated } from "@core/kernel/errors.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import type { RequestWithPrincipal } from "./principal.js";
import { PERMISSION_KEY } from "./decorators.js";

/**
 * Enforces `@RequirePermission(action, resource)` — a live RBAC check against
 * the caller's *active tenant*, so a permission revoked after login takes
 * effect immediately. Runs after `JwtAuthGuard`. Wrapped in a transaction so
 * RLS on `user_roles` is in force (§ docs/tenancy.md).
 *
 * Replaces the old Fastify `requirePermission` preHandler.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{ action: string; resource: string } | undefined>(
      PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required) return true;

    const principal = ctx.switchToHttp().getRequest<RequestWithPrincipal>().principal;
    if (!principal) throw Unauthenticated();

    const allowed = await readInTenant(() =>
      this.permissions.can(principal.userId, required.action, required.resource),
    );
    if (!allowed) {
      throw Forbidden("auth.forbidden", `Missing permission: ${required.action}:${required.resource}`);
    }
    return true;
  }
}
