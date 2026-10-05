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
import { RaqibModule } from "@raqib/raqib/raqib.module.js";
import { DemoModule } from "@raqib/raqib/demo/demo.module.js";
import { AppSeedService } from "./seed.js";

/**
 * The Raqib application — the composition root, mirroring `hotel-project/backend/app/app.module.ts`.
 * This is a SEPARATE deployment from Mizan, Atlas and HotelOS: its own process, own port, own Postgres
 * database, own users/organizations/roles — Core's *source* is shared by relative import, nothing else.
 *
 * `MessagingModule` (real-time chat) and the AI assistant are deliberately not imported: nothing in
 * Raqib needs them. Their tables still exist because the copied Core baseline migrations are kept
 * complete and identical to Core's.
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
    RaqibModule,
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
