import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Forbidden, Unauthenticated } from "../../kernel/errors.js";
import { patchContext } from "../../kernel/logging/context.js";
import type { IPermissionProvider } from "../../contracts/index.js";
import type { JwtService } from "../infrastructure/jwt-service.js";

/**
 * Auth middleware (§3.4): verifies the bearer JWT, attaches the principal to
 * the request, and adds userId to the ambient request context so logs and
 * audit entries carry it automatically.
 */
export interface Principal {
  userId: string;
  email: string;
  /** Permission keys ("action:resource") baked into the token at login. */
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export function createAuthMiddleware(jwtService: JwtService) {
  return function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next(Unauthenticated());
      return;
    }
    try {
      const claims = jwtService.verifyAccessToken(header.slice("Bearer ".length));
      req.principal = { userId: claims.sub, email: claims.email, permissions: claims.perms };
      patchContext({ userId: claims.sub });
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        next(Unauthenticated("auth.token_expired", "Your session has expired."));
      } else {
        next(Unauthenticated("auth.invalid_token", "Invalid authentication token."));
      }
    }
  };
}

export function requireAuth(req: { principal?: Principal }): Principal {
  if (!req.principal) throw Unauthenticated();
  return req.principal;
}

/**
 * Route guard backed by the live RBAC provider (not just the token claims),
 * so a permission revoked after login takes effect immediately.
 */
export function requirePermission(permissions: IPermissionProvider, action: string, resource: string) {
  return function guard(req: Request, _res: Response, next: NextFunction): void {
    const principal = req.principal;
    if (!principal) {
      next(Unauthenticated());
      return;
    }
    permissions
      .can(principal.userId, action, resource)
      .then((allowed) => {
        if (allowed) next();
        else next(Forbidden("auth.forbidden", `Missing permission: ${action}:${resource}`));
      })
      .catch(next);
  };
}
