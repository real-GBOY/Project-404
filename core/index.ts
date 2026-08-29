import { randomUUID } from "node:crypto";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { getConfig, type AuricConfig } from "./kernel/config.js";
import { systemClock, type Clock } from "./kernel/clock.js";
import { unitOfWork, closeDb, type UnitOfWork } from "./kernel/db/db.js";
import { closePool } from "./kernel/db/pool.js";
import { migrateToLatest } from "./kernel/db/migrate.js";
import { rootLogger } from "./kernel/logging/logger.js";
import type { PermissionDefinition } from "./rbac/domain/permission.js";

import { EventRegistry } from "./events/registry.js";
import { EventBus } from "./events/event-bus.js";
import { OutboxRepository } from "./events/outbox/outbox-repository.js";
import { OutboxWorker } from "./events/outbox/outbox-worker.js";

import { createAuditModule } from "./audit/index.js";
import { createRbacModule } from "./rbac/index.js";
import { createIdentityModule } from "./identity/index.js";
import { createOrganizationsModule } from "./organizations/index.js";
import { createFilesModule } from "./files/index.js";
import { createNotificationsModule } from "./notifications/index.js";
import { createLocalizationModule } from "./localization/index.js";

import { createRouteContext } from "./http/route-context.js";
import { installObservability } from "./observability/http.js";
import { loggingErrorTracker } from "./observability/errors/error-tracker.js";
import { healthPlugin } from "./observability/health/health.js";

export const CORE_VERSION = "0.1.0";

export interface CreateCoreOptions {
  config?: Partial<AuricConfig>;
  clock?: Clock;
  /** Skip starting the outbox worker (tests drive it by hand). */
  startWorker?: boolean;
  /** Replace the email transport (tests capture instead of sending). */
  emailChannel?: import("./notifications/infrastructure/email-channel.js").EmailChannel;
}

export interface AuricCore {
  app: FastifyInstance;
  config: AuricConfig;
  modules: {
    audit: ReturnType<typeof createAuditModule>;
    rbac: ReturnType<typeof createRbacModule>;
    identity: ReturnType<typeof createIdentityModule>;
    organizations: ReturnType<typeof createOrganizationsModule>;
    files: ReturnType<typeof createFilesModule>;
    notifications: ReturnType<typeof createNotificationsModule>;
    localization: ReturnType<typeof createLocalizationModule>;
  };
  registry: EventRegistry;
  worker: OutboxWorker;
  /** The IEventBus wired into every module — exposed for host code and tests. */
  events: EventBus;
  outbox: OutboxRepository;
  uow: UnitOfWork;
  clock: Clock;
  /** Run pending DB migrations. */
  migrate(): Promise<void>;
  /** Idempotent seeding (RBAC permissions + roles, notification templates). */
  seed(): Promise<void>;
  /** migrate + seed + start worker. */
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * The composition root (§3.4: "Core is the shared set of capabilities the use
 * case leans on"). Wires the kernel, the event system, and every Core module
 * in dependency order, then mounts their routes onto one Fastify app — the
 * modular monolith (§3.0): one deployable, strict module boundaries, no
 * network hops between modules.
 */
export function createAuricCore(options: CreateCoreOptions = {}): AuricCore {
  const config: AuricConfig = { ...getConfig(), ...options.config };
  const clock = options.clock ?? systemClock;

  // ── event system ────────────────────────────────────────────────────────
  const registry = new EventRegistry();
  const outboxRepo = new OutboxRepository(clock, config.outboxMaxAttempts);
  const events = new EventBus(registry, outboxRepo, clock);
  const worker = new OutboxWorker(registry, outboxRepo, clock, {
    pollIntervalMs: config.outboxPollIntervalMs,
    batchSize: config.outboxBatchSize,
  });

  // ── modules, in dependency order ────────────────────────────────────────
  const localization = createLocalizationModule(config);
  const audit = createAuditModule();
  const rbac = createRbacModule({ uow: unitOfWork, audit: audit.logger });
  const identity = createIdentityModule({
    config,
    clock,
    uow: unitOfWork,
    events,
    audit: audit.logger,
    permissions: rbac.permissionProvider,
  });
  const organizations = createOrganizationsModule({
    uow: unitOfWork,
    users: identity.userProvider,
    audit: audit.logger,
    events,
  });
  const files = createFilesModule({
    config,
    clock,
    uow: unitOfWork,
    permissions: rbac.permissionProvider,
  });
  const notifications = createNotificationsModule({
    config,
    clock,
    uow: unitOfWork,
    events,
    users: identity.userProvider,
    registry,
    ...(options.emailChannel ? { emailChannel: options.emailChannel } : {}),
  });

  const allPermissions: PermissionDefinition[] = [
    ...identity.permissions,
    ...rbac.permissions,
    ...organizations.permissions,
    ...audit.permissions,
    ...files.permissions,
    ...notifications.permissions,
  ];

  // ── HTTP app (the in-process API layer, §3.1 — not a gateway service) ────
  const app: FastifyInstance = Fastify({
    // pino's Logger is a superset of FastifyBaseLogger; share the one instance
    // so HTTP logs carry the same correlation-id mixin and redaction. Request
    // logging follows the log level — silent in tests, on in prod.
    loggerInstance: rootLogger as unknown as FastifyBaseLogger,
    bodyLimit: 1_048_576,
    genReqId: (req) => {
      const h = req.headers["x-correlation-id"];
      return (Array.isArray(h) ? h[0] : h)?.trim() || randomUUID();
    },
  });

  installObservability(app, { errorTracker: loggingErrorTracker });
  app.addHook("onRequest", localization.hook);

  const routeCtx = createRouteContext(identity.jwt, rbac.permissionProvider);
  app.register(
    async (api) => {
      await api.register(healthPlugin({ outbox: outboxRepo, worker, version: CORE_VERSION }));
      await api.register(identity.routes(routeCtx));
      await api.register(rbac.routes(routeCtx));
      await api.register(organizations.routes(routeCtx));
      await api.register(audit.routes(routeCtx));
      await api.register(files.routes(routeCtx));
      await api.register(notifications.routes(routeCtx));
    },
    { prefix: "/api" },
  );

  const migrate = async () => {
    await migrateToLatest(config.databaseUrl);
  };

  const seed = async () => {
    await rbac.seed(allPermissions);
    await notifications.seed();
  };

  return {
    app,
    config,
    modules: { audit, rbac, identity, organizations, files, notifications, localization },
    registry,
    worker,
    events,
    outbox: outboxRepo,
    uow: unitOfWork,
    clock,
    migrate,
    seed,
    async start() {
      await migrate();
      await seed();
      await app.ready();
      if (options.startWorker !== false) worker.start();
      rootLogger.info({ version: CORE_VERSION }, "AURIC Core started");
    },
    async stop() {
      await worker.stop();
      await app.close().catch(() => {});
      await closeDb().catch(() => {});
      await closePool().catch(() => {});
    },
  };
}

export type { AuricConfig } from "./kernel/config.js";
