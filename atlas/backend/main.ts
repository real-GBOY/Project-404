import "reflect-metadata";
import { AppModule } from "@atlas/app.module.js";
import { AppSeedService } from "@atlas/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@atlas/version.js";
import { bootstrapAuricApp } from "@core/http/bootstrap.js";
import { migrateToLatest } from "./scripts/migrate.js";

/**
 * Single-process entrypoint for the Atlas RE OS backend — a fully separate deployment from
 * Mizan's (own database, own port, own JWT secret). The boot sequence and HTTP conventions are
 * Core's (`bootstrapAuricApp`); this file says what Atlas is, how it migrates (its own Prisma
 * project) and how it seeds (Core RBAC + Atlas real-estate RBAC).
 */
void bootstrapAuricApp({
  module: AppModule,
  identity: { name: APP_NAME, codename: APP_CODENAME, version: APP_VERSION },
  migrate: migrateToLatest,
  seed: (app) => app.get(AppSeedService).seed(),
});
