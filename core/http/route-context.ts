import type { preHandlerHookHandler } from "fastify";
import type { IPermissionProvider } from "../contracts/index.js";
import { createAuthenticate, requirePermission } from "../identity/api/auth-middleware.js";
import type { JwtService } from "../identity/infrastructure/jwt-service.js";

/**
 * What every module's route plugin needs from the host: how to require a
 * logged-in principal, and how to require a specific permission. Modules
 * declare their own routes but never wire auth themselves.
 */
export interface RouteContext {
  authenticate: preHandlerHookHandler;
  guard(action: string, resource: string): preHandlerHookHandler;
}

export function createRouteContext(jwt: JwtService, permissions: IPermissionProvider): RouteContext {
  return {
    authenticate: createAuthenticate(jwt),
    guard: (action, resource) => requirePermission(permissions, action, resource),
  };
}
