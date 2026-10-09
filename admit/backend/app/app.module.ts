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
  SecurityModule,
  SeedService,
} from "@core/index.js";
import { AppExceptionFilter } from "@core/http/app-exception.filter.js";
import { RequestContextMiddleware } from "@core/http/request-context.middleware.js";
import { HealthController } from "@core/observability/health.controller.js";
import { AdmitModule } from "@admit/admit/admit.module.js";
import { AppSeedService } from "./seed.js";

/**
 * The Admit application - the composition root, mirroring `hotel-project/backend/app/app.module.ts`.
 * This is a SEPARATE deployment from Mizan, Atlas, HotelOS and Raqib: its own process, own port, own
 * Postgres database, own users/organizations/roles - Core's *source* is shared by relative import,
 * nothing else is.
 *
 * `MessagingModule` (real-time chat) and the AI assistant are deliberately not imported: nothing in
 * Admit needs them. Their tables still exist because the copied Core baseline migrations are kept
 * complete and identical to Core's. Outgoing email is NOT sent by Core's in-process mailer: Admit
 * writes `admit_email_messages` rows in the same transaction as the change that causes them and the
 * Python worker in `admit/worker` delivers them (see docs/architecture.md).
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
    SecurityModule,
    AdmitModule,
  ],
  controllers: [HealthController],
  providers: [SeedService, AppSeedService, RequestContextMiddleware, { provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
