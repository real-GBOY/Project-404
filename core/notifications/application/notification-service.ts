import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../../kernel/db/db.js";
import { readInTenant } from "../../kernel/db/db.js";
import type { AuricConfig } from "../../kernel/config.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import { CONFIG, EMAIL_CHANNEL, EVENT_BUS, UNIT_OF_WORK, USER_PROVIDER } from "../../kernel/tokens.js";
import type {
  INotificationProvider,
  IUserProvider,
  IEventBus,
  NotificationPayload,
} from "../../contracts/index.js";
import type { DomainEvent } from "../../contracts/domain-event.js";
import { t } from "../../localization/i18n/catalog.js";
import { NotificationRepository, type NotificationRow } from "../infrastructure/notification-repository.js";
import { TemplateRepository } from "../infrastructure/template-repository.js";
import type { EmailChannel } from "../infrastructure/email-channel.js";

const log = moduleLogger("notifications");

export const NotificationEvents = {
  EmailRequested: "notification.email_requested",
} as const;

/**
 * Notifications start-here (§7.5): in-app + email, templated, bilingual.
 * In-app writes happen inside the caller's transaction (internal effect).
 * Email is an external effect → published as an event and delivered by the
 * outbox worker (§6.1), never inline.
 */
@Injectable()
export class NotificationService implements INotificationProvider {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly templates: TemplateRepository,
    @Inject(EMAIL_CHANNEL) private readonly email: EmailChannel,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CONFIG) private readonly config: AuricConfig,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const locale = payload.locale ?? (await this.localeFor(payload.userId));
    const channels = payload.channels ?? ["in_app"];

    if (channels.includes("in_app")) {
      const rendered = payload.templateKey
        ? await this.templates.render(payload.templateKey, "in_app", locale, {
            app: this.config.appName,
            ...(payload.data as Record<string, string | number> | undefined),
          })
        : null;
      const title = rendered?.subject ?? payload.title ?? this.config.appName;
      const body = rendered?.body ?? payload.body ?? "";
      await this.notifications.insert({
        userId: payload.userId,
        type: payload.type,
        title,
        body,
        locale,
        data: payload.data ?? null,
      });
    }

    if (channels.includes("email")) {
      const user = await this.users.getUser(payload.userId);
      if (!user?.email) {
        log.warn({ userId: payload.userId }, "email notification skipped — no address");
        return;
      }
      await this.events.publish({
        name: NotificationEvents.EmailRequested,
        version: 1,
        payload: {
          to: user.email,
          templateKey: payload.templateKey ?? null,
          subject: payload.title ?? null,
          body: payload.body ?? null,
          locale,
          params: (payload.data as Record<string, unknown> | undefined) ?? {},
        },
      });
    }
  }

  /** External handler (outbox): actually sends an email. */
  async deliverEmail(event: DomainEvent): Promise<void> {
    const p = event.payload as {
      to: string;
      templateKey: string | null;
      subject: string | null;
      body: string | null;
      locale: string;
      params: Record<string, string | number>;
    };

    let subject = p.subject ?? this.config.appName;
    let body = p.body ?? "";

    if (p.templateKey) {
      const rendered = await this.uow.transaction(() =>
        this.templates.render(p.templateKey!, "email", p.locale, { app: this.config.appName, ...p.params }),
      );
      if (rendered) {
        subject = rendered.subject ?? subject;
        body = rendered.body;
      } else {
        log.warn({ templateKey: p.templateKey }, "email template not found — using fallback");
      }
    }

    await this.email.send({ to: p.to, subject, text: body });
  }

  // ─── Identity event handlers (external → email) ────────────────────────────

  async onEmailVerificationRequested(event: DomainEvent): Promise<void> {
    const p = event.payload as { email: string; token: string; locale: string | null };
    const link = `${this.config.appUrl}/verify-email?token=${encodeURIComponent(p.token)}`;
    await this.email.send({
      to: p.email,
      subject: await this.subjectFor("email_verification", p.locale),
      text: await this.bodyFor("email_verification", p.locale, { link }),
    });
  }

  async onPasswordResetRequested(event: DomainEvent): Promise<void> {
    const p = event.payload as { email: string; token: string; locale: string | null };
    const link = `${this.config.appUrl}/reset-password?token=${encodeURIComponent(p.token)}`;
    await this.email.send({
      to: p.email,
      subject: await this.subjectFor("password_reset", p.locale),
      text: await this.bodyFor("password_reset", p.locale, { link }),
    });
  }

  /** In-process handler: a welcome notification, written in the register tx. */
  async onUserRegistered(event: DomainEvent): Promise<void> {
    const p = event.payload as { userId: string; locale: string | null };
    const locale = p.locale ?? this.config.defaultLocale;
    const rendered = await this.templates.render("welcome", "in_app", locale, { app: this.config.appName });
    await this.notifications.insert({
      userId: p.userId,
      type: "welcome",
      title: rendered?.subject ?? t("notification.welcome_title", locale, { app: this.config.appName }),
      body: rendered?.body ?? t("notification.welcome_body", locale, { app: this.config.appName }),
      locale,
    });
  }

  // ─── Read side ────────────────────────────────────────────────────────────

  listForUser(userId: string, opts: { unreadOnly?: boolean; limit?: number; cursor?: string }) {
    return readInTenant(() => this.notifications.listForUser(userId, opts));
  }
  unreadCount(userId: string): Promise<number> {
    return readInTenant(() => this.notifications.unreadCount(userId));
  }
  markRead(userId: string, id: string): Promise<void> {
    return this.uow.transaction(() => this.notifications.markRead(userId, id));
  }
  markAllRead(userId: string): Promise<void> {
    return this.uow.transaction(() => this.notifications.markAllRead(userId));
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async localeFor(userId: string): Promise<string> {
    const user = await this.users.getUser(userId);
    return user?.locale ?? this.config.defaultLocale;
  }

  private async subjectFor(key: string, locale: string | null): Promise<string> {
    const rendered = await this.uow.transaction(() =>
      this.templates.render(key, "email", locale ?? this.config.defaultLocale, { app: this.config.appName }),
    );
    return rendered?.subject ?? this.config.appName;
  }

  private async bodyFor(
    key: string,
    locale: string | null,
    params: Record<string, string | number>,
  ): Promise<string> {
    const rendered = await this.uow.transaction(() =>
      this.templates.render(key, "email", locale ?? this.config.defaultLocale, {
        app: this.config.appName,
        ...params,
      }),
    );
    return rendered?.body ?? "";
  }

  toPublic(row: NotificationRow) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      locale: row.locale,
      data: row.data,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
