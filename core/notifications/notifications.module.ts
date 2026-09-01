import { Module, type OnModuleInit } from "@nestjs/common";
import type { AuricConfig } from "../kernel/config.js";
import { CONFIG, EMAIL_CHANNEL, NOTIFICATION_PROVIDER } from "../kernel/tokens.js";
import { EventsModule } from "../events/events.module.js";
import { EventRegistry } from "../events/registry.js";
import { IdentityModule } from "../identity/identity.module.js";
import { NotificationRepository } from "./infrastructure/notification-repository.js";
import { TemplateRepository } from "./infrastructure/template-repository.js";
import { createEmailChannel } from "./infrastructure/email-channel.js";
import { NotificationService } from "./application/notification-service.js";
import { registerNotificationSubscribers } from "./events/subscribers.js";
import { NotificationsController } from "./api/notifications.controller.js";

/**
 * Notifications (§7.5) — in-app + email, templated, bilingual. Reacts to
 * identity events (verification / reset email, welcome note) — wired in
 * `OnModuleInit`.
 */
@Module({
  imports: [EventsModule, IdentityModule],
  controllers: [NotificationsController],
  providers: [
    NotificationRepository,
    TemplateRepository,
    NotificationService,
    { provide: NOTIFICATION_PROVIDER, useExisting: NotificationService },
    {
      provide: EMAIL_CHANNEL,
      inject: [CONFIG],
      useFactory: (config: AuricConfig) =>
        createEmailChannel({
          from: config.mailFrom,
          ...(config.smtpUrl ? { smtpUrl: config.smtpUrl } : {}),
        }),
    },
  ],
  exports: [NOTIFICATION_PROVIDER, TemplateRepository],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    private readonly service: NotificationService,
  ) {}

  onModuleInit(): void {
    registerNotificationSubscribers(this.registry, this.service);
  }
}
