import "reflect-metadata";
import { AppModule } from "@app/app.module.js";
import { AppSeedService } from "@app/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@app/version.js";
import { bootstrapAuricApp } from "@core/http/bootstrap.js";

/**
 * Single-process entrypoint for the Mizan client application. The boot sequence and HTTP
 * conventions are Core's (`bootstrapAuricApp`); this file only says what Mizan is and how it
 * seeds (Core RBAC + law-firm RBAC).
 */
void bootstrapAuricApp({
  module: AppModule,
  identity: { name: APP_NAME, codename: APP_CODENAME, version: APP_VERSION },
  seed: (app) => app.get(AppSeedService).seed(),
});
