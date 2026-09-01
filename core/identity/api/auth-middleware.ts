import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import jwt from "jsonwebtoken";
import { Forbidden, Unauthenticated } from "../../kernel/errors.js";
import { patchContext } from "../../kernel/logging/context.js";
import { readInTenant } from "../../kernel/db/db.js";
import type { IPermissionProvider } from "../../contracts/index.js";
import type { JwtService } from "../infrastructure/jwt-service.js";

/**
 * Auth hooks (§3.4): verify the bearer JWT, attach the principal to the
 * request, and add userId to the ambient request context so logs and audit
 * entries carry it automatically.
 */
export interface Principal {
  userId: string;
  email: string;
  /** The active tenant (§ docs/tenancy.md), or null for an orgless token. */
  organizationId: string | null;
  /** Permission keys ("action:resource") baked into the token, scoped to `organizationId`. */
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export function createAuthenticate(jwtService: JwtService): preHandlerHookHandler {
  return async function authenticate(req: FastifyRequest): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw Unauthenticated();
    try {
      const claims = jwtService.verifyAccessToken(header.slice("Bearer ".length));
      req.principal = {
        userId: claims.sub,
        email: claims.email,
        organizationId: claims.org,
        permissions: claims.perms,
      };
      // Push the principal into the ambient context: logs and audit rows pick up
      // userId, and every tenant-scoped transaction gets `SET LOCAL
      // app.organization_id` so RLS filters it (§ docs/tenancy.md).
      patchContext({ userId: claims.sub, ...(claims.org ? { organizationId: claims.org } : {}) });
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw Unauthenticated("auth.token_expired", "Your session has expired.");
      }
      throw Unauthenticated("auth.invalid_token", "Invalid authentication token.");
    }
  };
}

export function requireAuth(req: { principal?: Principal }): Principal {
  if (!req.principal) throw Unauthenticated();
  return req.principal;
}

/**
 * Route guard backed by the live RBAC provider (not just the token claims),
 * so a permission revoked after login takes effect immediately. Runs after
 * `authenticate` in the same preHandler array.
 */
export function requirePermission(
  permissions: IPermissionProvider,
  action: string,
  resource: string,
): preHandlerHookHandler {
  return async function guard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const principal = req.principal;
    if (!principal) throw Unauthenticated();
    // Wrap in a transaction so RLS on `user_roles` is scoped to the active
    // tenant (§ docs/tenancy.md); the guard runs before any use-case tx.
    const allowed = await readInTenant(() => permissions.can(principal.userId, action, resource));
    if (!allowed) throw Forbidden("auth.forbidden", `Missing permission: ${action}:${resource}`);
  };
}
