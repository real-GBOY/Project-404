import "reflect-metadata";
import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "@app/app.module.js";
import { AppSeedService } from "@app/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@app/version.js";
import { getConfig } from "@core/kernel/config.js";
import { migrateToLatest } from "@core/kernel/db/migrate.js";
import { rootLogger } from "@core/kernel/logging/logger.js";
import { CORE_VERSION } from "@core/version.js";

/**
 * Single-process entrypoint for the Mizan client application. Migrates, seeds
 * (Core RBAC + law-firm RBAC), then serves the HTTP API — the whole modular
 * monolith in one process (§3.0). The outbox worker starts via
 * `OnApplicationBootstrap` when `app.listen()` fires.
 */
async function main() {
  const config = getConfig();

  await migrateToLatest(config.databaseUrl);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1_048_576 }),
  );
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();

  await app.get(AppSeedService).seed();

  await app.listen({ port: config.port, host: "0.0.0.0" });
  rootLogger.info(
    {
      app: APP_NAME,
      codename: APP_CODENAME,
      appVersion: APP_VERSION,
      core: CORE_VERSION,
      url: `http://localhost:${config.port}/api/health`,
    },
    `${APP_NAME} (${APP_CODENAME}) — running on AURIC Core ${CORE_VERSION}`,
  );
}

main().catch((err) => {
  rootLogger.fatal({ err }, "failed to start");
  process.exit(1);
});
