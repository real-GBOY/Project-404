import "reflect-metadata";
import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "@atlas/app.module.js";
import { AppSeedService } from "@atlas/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@atlas/version.js";
import { getConfig } from "@core/kernel/config.js";
import { rootLogger } from "@core/kernel/logging/logger.js";
import { setupOpenApi } from "@core/http/openapi.js";
import { CORE_VERSION } from "@core/version.js";
import { migrateToLatest } from "./scripts/migrate.js";

/**
 * Single-process entrypoint for the Atlas RE OS backend — a fully separate
 * deployment from Mizan's (own database, own port, own JWT secret). Migrates,
 * seeds (Core RBAC + Atlas real-estate RBAC), then serves the HTTP API.
 * Byte-for-byte the same shape as the root repo's `main.ts` (Mizan's
 * entrypoint) — see that file for the rationale behind each step.
 */
async function main() {
  const config = getConfig();

  await migrateToLatest(config.databaseUrl);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1_048_576 }),
  );
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      "application/octet-stream",
      { parseAs: "buffer", bodyLimit: config.fileMaxUploadBytes },
      (_req, body, done) => done(null, body),
    );

  app.setGlobalPrefix("api");
  app.enableShutdownHooks();

  const isDev = config.nodeEnv !== "production";
  if (config.corsOrigins.length > 0 || isDev) {
    const configured = config.corsOrigins.map((o) =>
      o.startsWith("*.") ? new RegExp(`${o.slice(1).replace(/[.]/g, "\\$&")}$`) : o,
    );
    const devOrigin =
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

    app.enableCors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (devOrigin.test(origin)) return cb(null, true);
        const allowed = configured.some((o) =>
          o instanceof RegExp ? o.test(origin) : o === origin,
        );
        cb(null, allowed);
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["authorization", "content-type"],
      maxAge: 86_400,
    });
  }

  setupOpenApi(app, {
    title: `${APP_NAME} API`,
    version: APP_VERSION,
    description: `${APP_NAME} (${APP_CODENAME}) — running on AURIC Core ${CORE_VERSION}. Interactive docs; most write routes need a Bearer access token (see /api/auth/login).`,
  });

  await app.get(AppSeedService).seed();

  await app.listen({ port: config.port, host: "0.0.0.0" });
  rootLogger.info(
    {
      app: APP_NAME,
      codename: APP_CODENAME,
      appVersion: APP_VERSION,
      core: CORE_VERSION,
      health: `http://localhost:${config.port}/api/health`,
      docs: `http://localhost:${config.port}/api/docs`,
    },
    `${APP_NAME} (${APP_CODENAME}) — running on AURIC Core ${CORE_VERSION}`,
  );
}

main().catch((err) => {
  rootLogger.fatal({ err }, "failed to start");
  process.exit(1);
});
