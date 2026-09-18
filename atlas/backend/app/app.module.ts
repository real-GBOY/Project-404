import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import {
  KernelModule,
  EventsModule,
  AuditModule,
  RbacModule,
  IdentityModule,
  OrganizationsModule,
  NotificationsModule,
  FilesModule,
  MessagingModule,
  SecurityModule,
  SeedService,
} from "@core/index.js";
import { AppExceptionFilter } from "@core/http/app-exception.filter.js";
import { RequestContextMiddleware } from "@core/http/request-context.middleware.js";
import { HealthController } from "@core/observability/health.controller.js";
import { RealestateModule } from "@atlas/realestate/realestate.module.js";
import { DemoModule } from "@atlas/realestate/demo/demo.module.js";
import { AppSeedService } from "./seed.js";

/**
 * The Atlas RE OS application — the composition root, mirroring
 * `mizan/backend/app/app.module.ts` exactly (see that file's doc comment for
 * the full rationale). This is a SEPARATE deployment from Mizan's: its own
 * process, own port, own Postgres database, own users/organizations/roles —
 * Core's *source* is shared by relative import, nothing else is.
 *
 * `main.ts` boots this, not `core/app.module.ts` (Core's own test fixture) and
 * not Mizan's `mizan/backend/app/app.module.ts`.
 */
@Module({
  imports: [
    KernelModule,
    EventsModule,
    AuditModule,
    RbacModule,
    IdentityModule,
    OrganizationsModule,
    NotificationsModule,
    FilesModule,
    MessagingModule,
    SecurityModule,
    RealestateModule,
    DemoModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedService,
    AppSeedService,
    RequestContextMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
