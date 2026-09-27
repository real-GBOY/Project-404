import "reflect-metadata";
import { AppModule } from "@hotel/app.module.js";
import { AppSeedService } from "@hotel/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@hotel/version.js";
import { bootstrapAuricApp } from "@core/http/bootstrap.js";
import { migrateToLatest } from "./scripts/migrate.js";

/**
 * Single-process entrypoint for the HotelOS backend — a fully separate deployment from Mizan's
 * and Atlas's (own database, own port, own JWT secret). The boot sequence and HTTP conventions
 * are Core's (`bootstrapAuricApp`); this file says what HotelOS is, how it migrates (its own
 * Prisma project) and how it seeds (Core RBAC + HotelOS RBAC, then the opt-in demo hotel).
 */
void bootstrapAuricApp({
  module: AppModule,
  identity: { name: APP_NAME, codename: APP_CODENAME, version: APP_VERSION },
  migrate: migrateToLatest,
  seed: (app) => app.get(AppSeedService).seed(),
});
