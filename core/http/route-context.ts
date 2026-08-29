import type { RequestHandler } from "express";
import type { IPermissionProvider } from "../contracts/index.js";
import { createAuthMiddleware, requirePermission } from "../identity/api/auth-middleware.js";
import type { JwtService } from "../identity/infrastructure/jwt-service.js";

/**
 * What every module's route builder needs from the host: how to require a
 * logged-in principal, and how to require a specific permission. Modules
 * declare their own routes but never wire auth themselves.
 */
export interface RouteContext {
  authenticate: RequestHandler;
  guard(action: string, resource: string): RequestHandler;
}

export function createRouteContext(jwt: JwtService, permissions: IPermissionProvider): RouteContext {
  return {
    authenticate: createAuthMiddleware(jwt),
    guard: (action, resource) => requirePermission(permissions, action, resource),
  };
}
