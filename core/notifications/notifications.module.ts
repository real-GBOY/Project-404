import { Module, type OnModuleInit } from "@nestjs/common";
import type { AuricConfig } from "@core/kernel/config.js";
import { CONFIG, EMAIL_CHANNEL, NOTIFICATION_PROVIDER } from "@core/kernel/tokens.js";
import { EventsModule } from "@core/events/events.module.js";
import { EventRegistry } from "@core/events/registry.js";
import { IdentityModule } from "@core/identity/identity.module.js";
import { NotificationRepository } from "@core/notifications/infrastructure/notification-repository.js";
import { TemplateRepository } from "@core/notifications/infrastructure/template-repository.js";
import { createEmailChannel } from "@core/notifications/infrastructure/email-channel.js";
import { NotificationService } from "@core/notifications/application/notification-service.js";
import { registerNotificationSubscribers } from "@core/notifications/events/subscribers.js";
import { NotificationsController } from "@core/notifications/api/notifications.controller.js";

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
