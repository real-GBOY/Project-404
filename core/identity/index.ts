import type { FastifyPluginAsync } from "fastify";
import type { Clock } from "../kernel/clock.js";
import type { UnitOfWork } from "../kernel/db/db.js";
import type { AuricConfig } from "../kernel/config.js";
import type {
  IAuditLogger,
  IEventBus,
  IOrganizationProvider,
  IPermissionProvider,
  IUserProvider,
} from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import { UserRepository } from "./infrastructure/user-repository.js";
import { RefreshTokenRepository } from "./infrastructure/refresh-token-repository.js";
import { VerificationTokenRepository } from "./infrastructure/verification-token-repository.js";
import { argon2Hasher, type PasswordHasher } from "./infrastructure/password-hasher.js";
import { createJwtService, type JwtService } from "./infrastructure/jwt-service.js";
import { IdentityUserProvider } from "./infrastructure/user-provider.js";
import { IdentityService } from "./application/identity-service.js";
import { identityRoutes } from "./api/routes.js";
import { identityPermissions } from "./permissions/permissions.js";

export interface IdentityModuleDeps {
  config: AuricConfig;
  clock: Clock;
  uow: UnitOfWork;
  events: IEventBus;
  audit: IAuditLogger;
  permissions: IPermissionProvider;
  /**
   * Lazily resolved to break the identity ↔ organizations wiring cycle
   * (identity needs membership lookups at login; organizations needs the user
   * provider). Only called at request time, by which point both modules exist.
   */
  organizations: () => IOrganizationProvider;
  hasher?: PasswordHasher;
  /** Override to false for admin-provisioned deployments. */
  requireEmailVerification?: boolean;
}

export interface IdentityModule {
  service: IdentityService;
  userProvider: IUserProvider;
  jwt: JwtService;
  routes(ctx: RouteContext): FastifyPluginAsync;
  permissions: typeof identityPermissions;
}

export function createIdentityModule(deps: IdentityModuleDeps): IdentityModule {
  const users = new UserRepository();
  const refreshTokens = new RefreshTokenRepository(deps.clock);
  const verificationTokens = new VerificationTokenRepository(deps.clock);
  const hasher = deps.hasher ?? argon2Hasher;
  const jwt = createJwtService({
    secret: deps.config.jwtSecret,
    accessTtlSeconds: deps.config.accessTokenTtl,
    clock: deps.clock,
  });

  const service = new IdentityService({
    users,
    refreshTokens,
    verificationTokens,
    hasher,
    jwt,
    events: deps.events,
    audit: deps.audit,
    permissions: deps.permissions,
    organizations: deps.organizations,
    uow: deps.uow,
    clock: deps.clock,
    options: {
      requireEmailVerification: deps.requireEmailVerification ?? true,
      accessTokenTtlSeconds: deps.config.accessTokenTtl,
      refreshTokenTtlSeconds: deps.config.refreshTokenTtl,
      emailVerificationTtlSeconds: 60 * 60 * 24, // 24h
      passwordResetTtlSeconds: 60 * 60, // 1h
    },
  });

  const userProvider = new IdentityUserProvider(users);

  return {
    service,
    userProvider,
    jwt,
    routes: (ctx) => identityRoutes(service, userProvider, ctx),
    permissions: identityPermissions,
  };
}
