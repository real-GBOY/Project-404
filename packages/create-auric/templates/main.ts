import "reflect-metadata";
import { AppModule } from "@core/app.module.js";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { bootstrapAuricApp } from "@core/http/bootstrap.js";
import { CORE_VERSION } from "@core/version.js";

/**
 * Process entrypoint. Boot order (migrate → build → configure → seed → listen)
 * and the HTTP conventions are Core's `bootstrapAuricApp`; this file only says
 * what the application is called and how it seeds.
 *
 * Build your product beside Core: add your own Nest modules, import them into
 * `AppModule` (src/core/app.module.ts) or a root module of your own, and extend
 * `SeedService` with your permissions.
 */
void bootstrapAuricApp({
  module: AppModule,
  identity: { name: "{{name}}", codename: "{{name}}", version: CORE_VERSION },
  seed: (app) => app.get(SeedService).seed(),
});
