import multipart from "@fastify/multipart";
import type { Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { type AuricConfig, getConfig } from "@core/kernel/config.js";
import { migrateToLatest } from "@core/kernel/db/migrate.js";
import { rootLogger } from "@core/kernel/logging/logger.js";
import { setupOpenApi } from "@core/http/openapi.js";
import { CORE_VERSION } from "@core/version.js";

/**
 * The process entrypoint every AURIC application shares. Core owns the MECHANISM — how the
 * HTTP server is assembled (Fastify limits, multipart, raw-body upload parser, `/api` prefix,
 * shutdown hooks, CORS, OpenAPI) and the boot order (migrate → build → configure → seed →
 * listen). The application owns the MEANING: which root module, how it migrates, how it seeds,
 * and what it is called. Nothing here knows about any product.
 */

export interface AuricAppIdentity {
  name: string;
  codename: string;
  version: string;
}

export interface BootstrapOptions {
  /** The application's root Nest module (imports Core's modules + the product's). */
  module: Type<unknown>;
  identity: AuricAppIdentity;
  /** Runs before the app is built. Defaults to Core's own migrations (the repo-root Prisma project). */
  migrate?: (databaseUrl: string) => Promise<void>;
  /** Runs after the app is configured and before it listens — idempotent baseline data. */
  seed: (app: NestFastifyApplication) => Promise<void>;
}

/** Any localhost / loopback / private-LAN origin, on any port (Vite, Expo, a phone on the LAN). */
const DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

/**
 * Everything between "the app exists" and "the app listens": multipart, the raw-body upload
 * parser, the `/api` prefix, shutdown hooks and CORS. Split from `bootstrapAuricApp` so it can
 * be exercised without a database.
 */
export async function configureAuricHttp(
  app: NestFastifyApplication,
  config: Pick<AuricConfig, "corsOrigins" | "nodeEnv" | "fileMaxUploadBytes">,
): Promise<void> {
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

  // Raw-body parser for the local storage driver's loopback upload route
  // (`PUT /api/files/:id/bytes`). A per-parser `bodyLimit` lifts the global
  // 1 MiB cap for octet-stream only — JSON, multipart, and every other route
  // keep the tight default.
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

    app.enableCors({
      origin: (origin, cb) => {
        // Non-browser callers (curl, native apps, same-origin) send no Origin.
        if (!origin) return cb(null, true);
        if (DEV_ORIGIN.test(origin)) return cb(null, true);
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
}

/** Build a Fastify-backed Nest app with Core's HTTP conventions applied. */
export async function createAuricApp(
  module: Type<unknown>,
  config: Pick<AuricConfig, "corsOrigins" | "nodeEnv" | "fileMaxUploadBytes">,
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    module,
    new FastifyAdapter({ bodyLimit: 1_048_576 }),
  );
  await configureAuricHttp(app, config);
  return app;
}

/**
 * Single-process entrypoint: migrate, build, seed, then serve the HTTP API — the whole modular
 * monolith in one process. The outbox worker starts via `OnApplicationBootstrap` when
 * `app.listen()` fires. Resolves once listening; on any startup failure logs fatally and exits.
 */
export async function bootstrapAuricApp(options: BootstrapOptions): Promise<void> {
  try {
    const { module, identity, seed } = options;
    const migrate = options.migrate ?? migrateToLatest;
    const config = getConfig();

    await migrate(config.databaseUrl);

    const app = await createAuricApp(module, config);

    setupOpenApi(app, {
      title: `${identity.name} API`,
      version: identity.version,
      description: `${identity.name} (${identity.codename}) — running on AURIC Core ${CORE_VERSION}. Interactive docs; most write routes need a Bearer access token (see /api/auth/login).`,
    });

    await seed(app);

    await app.listen({ port: config.port, host: "0.0.0.0" });
    rootLogger.info(
      {
        app: identity.name,
        codename: identity.codename,
        appVersion: identity.version,
        core: CORE_VERSION,
        health: `http://localhost:${config.port}/api/health`,
        docs: `http://localhost:${config.port}/api/docs`,
      },
      `${identity.name} (${identity.codename}) — running on AURIC Core ${CORE_VERSION}`,
    );
  } catch (err) {
    rootLogger.fatal({ err }, "failed to start");
    process.exit(1);
  }
}
