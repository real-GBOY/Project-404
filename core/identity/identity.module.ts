import { forwardRef, Module } from "@nestjs/common";
import type { AuricConfig } from "../kernel/config.js";
import type { Clock } from "../kernel/clock.js";
import {
  CLOCK,
  CONFIG,
  JWT_SERVICE,
  PASSWORD_HASHER,
  REQUIRE_EMAIL_VERIFICATION,
  USER_PROVIDER,
} from "../kernel/tokens.js";
import { AuditModule } from "../audit/audit.module.js";
import { EventsModule } from "../events/events.module.js";
import { RbacModule } from "../rbac/rbac.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { UserRepository } from "./infrastructure/user-repository.js";
import { RefreshTokenRepository } from "./infrastructure/refresh-token-repository.js";
import { VerificationTokenRepository } from "./infrastructure/verification-token-repository.js";
import { argon2Hasher } from "./infrastructure/password-hasher.js";
import { createJwtService } from "./infrastructure/jwt-service.js";
import { IdentityUserProvider } from "./infrastructure/user-provider.js";
import { IdentityService } from "./application/identity-service.js";
import { AuthController, MeController } from "./api/auth.controller.js";

/**
 * Identity & Authentication (§7.1). `USER_PROVIDER` is the `IUserProvider` other
 * modules reach user data through; `JWT_SERVICE` backs the auth guard.
 * Depends on Organizations (membership lookups at login) via `forwardRef` —
 * Organizations depends back on `USER_PROVIDER` (§ docs/tenancy.md).
 */
@Module({
  imports: [AuditModule, EventsModule, RbacModule, forwardRef(() => OrganizationsModule)],
  controllers: [AuthController, MeController],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    VerificationTokenRepository,
    IdentityUserProvider,
    IdentityService,
    { provide: USER_PROVIDER, useExisting: IdentityUserProvider },
    { provide: PASSWORD_HASHER, useValue: argon2Hasher },
    { provide: REQUIRE_EMAIL_VERIFICATION, useValue: true },
    {
      provide: JWT_SERVICE,
      inject: [CONFIG, CLOCK],
      useFactory: (config: AuricConfig, clock: Clock) =>
        createJwtService({
          secret: config.jwtSecret,
          accessTtlSeconds: config.accessTokenTtl,
          clock,
        }),
    },
  ],
  exports: [USER_PROVIDER, JWT_SERVICE],
})
export class IdentityModule {}
