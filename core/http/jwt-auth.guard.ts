import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { Unauthenticated } from "@core/kernel/errors.js";
import { patchContext } from "@core/kernel/logging/context.js";
import { JWT_SERVICE } from "@core/kernel/tokens.js";
import type { JwtService } from "@core/identity/infrastructure/jwt-service.js";
import type { RequestWithPrincipal } from "./principal.js";

/**
 * Verifies the bearer JWT, attaches the principal, and pushes userId + the
 * active tenant into the ambient request context (§ docs/tenancy.md) so logs,
 * audit rows, and every tenant-scoped transaction are scoped correctly.
 *
 * Replaces the old Fastify `authenticate` preHandler.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JWT_SERVICE) private readonly jwtService: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw Unauthenticated();
    try {
      const claims = this.jwtService.verifyAccessToken(header.slice("Bearer ".length));
      req.principal = {
        userId: claims.sub,
        email: claims.email,
        organizationId: claims.org,
        permissions: claims.perms,
      };
      patchContext({
        userId: claims.sub,
        ...(claims.org ? { organizationId: claims.org } : {}),
      });
      return true;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw Unauthenticated("auth.token_expired", "Your session has expired.");
      }
      throw Unauthenticated("auth.invalid_token", "Invalid authentication token.");
    }
  }
}
