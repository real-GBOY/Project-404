import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { SettingsRepository } from "@raqib/raqib/settings/infrastructure/settings-repository.js";
import { LifecycleModule } from "@raqib/raqib/lifecycle/lifecycle.module.js";
import { AccountController } from "./api/account.controller.js";
import { AuthSecurityInterceptor } from "./api/auth-security.interceptor.js";
import { AccountService } from "./application/account-service.js";
import { AccountRepository } from "./infrastructure/account-repository.js";

/** Global so the access guard (in every feature module) can ask whether a person must finish account set-up first. */
@Global()
@Module({
  imports: [AuditModule, AccessModule, LifecycleModule],
  controllers: [AccountController],
  providers: [AccountRepository, AccountService, SettingsRepository, { provide: APP_INTERCEPTOR, useClass: AuthSecurityInterceptor }],
  exports: [AccountService],
})
export class AccountModule {}
