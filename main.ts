import "reflect-metadata";
import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "@app/app.module.js";
import { AppSeedService } from "@app/seed.js";
import { APP_CODENAME, APP_NAME, APP_VERSION } from "@app/version.js";
import { getConfig } from "@core/kernel/config.js";
import { migrateToLatest } from "@core/kernel/db/migrate.js";
import { rootLogger } from "@core/kernel/logging/logger.js";
import { setupOpenApi } from "@core/http/openapi.js";
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

  // Cross-site access for a separately-hosted frontend (e.g. Vercel) and for
  // local development of the web/mobile clients (Expo/Vite dev servers on
  // localhost). Off entirely only when neither applies — the default nginx
  // deployment serves the SPA same-origin. Auth is Bearer-token only, so no
  // credentialed CORS.
  const isDev = config.nodeEnv !== "production";
  if (config.corsOrigins.length > 0 || isDev) {
    // An `*.example.com` entry becomes a host-suffix RegExp (Vercel previews);
    // anything else is matched literally.
    const configured = config.corsOrigins.map((o) =>
      o.startsWith("*.") ? new RegExp(`${o.slice(1).replace(/[.]/g, "\\$&")}$`) : o,
    );
    // Any localhost / loopback / private-LAN origin, on any port — covers
    // `expo start --web`, Vite, and a phone browser pointed at the dev host.
    const devOrigin =
      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

    app.enableCors({
      origin: (origin, cb) => {
        // Non-browser callers (curl, native apps, same-origin) send no Origin.
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
