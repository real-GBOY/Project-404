import type { FastifyPluginAsync } from "fastify";
import type { UnitOfWork } from "../kernel/db/db.js";
import type { Clock } from "../kernel/clock.js";
import type { AuricConfig } from "../kernel/config.js";
import type { INotificationProvider, IUserProvider, IEventBus } from "../contracts/index.js";
import type { RouteContext } from "../http/route-context.js";
import type { PermissionDefinition } from "../rbac/domain/permission.js";
import type { EventRegistry } from "../events/registry.js";
import { NotificationRepository } from "./infrastructure/notification-repository.js";
import { TemplateRepository } from "./infrastructure/template-repository.js";
import { createEmailChannel, type EmailChannel } from "./infrastructure/email-channel.js";
import { NotificationService } from "./application/notification-service.js";
import { registerNotificationSubscribers } from "./events/subscribers.js";
import { notificationRoutes } from "./api/routes.js";
import { notificationPermissions } from "./permissions/permissions.js";
import { seedTemplates } from "./templates/seed-templates.js";

export interface NotificationsModuleDeps {
  config: AuricConfig;
  clock: Clock;
  uow: UnitOfWork;
  events: IEventBus;
  users: IUserProvider;
  registry: EventRegistry;
  emailChannel?: EmailChannel;
}

export interface NotificationsModule {
  provider: INotificationProvider;
  service: NotificationService;
  templates: TemplateRepository;
  permissions: PermissionDefinition[];
  seed(): Promise<void>;
  routes(ctx: RouteContext): FastifyPluginAsync;
}

export function createNotificationsModule(deps: NotificationsModuleDeps): NotificationsModule {
  const notifications = new NotificationRepository(deps.clock);
  const templates = new TemplateRepository();
  const email =
    deps.emailChannel ??
    createEmailChannel({
      from: deps.config.mailFrom,
      ...(deps.config.smtpUrl ? { smtpUrl: deps.config.smtpUrl } : {}),
    });

  const service = new NotificationService({
    notifications,
    templates,
    email,
    users: deps.users,
    events: deps.events,
    uow: deps.uow,
    clock: deps.clock,
    defaultLocale: deps.config.defaultLocale,
    appName: deps.config.appName,
    appUrl: deps.config.appUrl,
  });

  registerNotificationSubscribers(deps.registry, service);

  return {
    provider: service,
    service,
    templates,
    permissions: notificationPermissions,
    seed: () => deps.uow.transaction(() => templates.upsertMany(seedTemplates)),
    routes: (ctx) => notificationRoutes(service, ctx),
  };
}
