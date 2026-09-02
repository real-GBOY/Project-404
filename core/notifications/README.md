# `core/notifications` — notifications

## 1. What it is

Templated, bilingual (AR/EN) notification delivery over two channels — **in-app**
and **email** (Plan §7.5). Exposes `INotificationProvider.send(payload)` and
reacts to platform events (verification / reset email, welcome note). The in-app
side is queryable via `GET /api/notifications`.

## 2. Why it exists

Applications constantly need to tell users things ("hearing scheduled", "payment
received", "verify your email"). The pipeline — resolve a template per locale,
fan out to channels, store the in-app copy, deliver email out-of-band — is the
same everywhere.

## 3. What problem it solves

- One notification API instead of ad-hoc `mailer.send()` calls sprinkled around.
- Locale-correct content (Arabic-first) without every caller doing i18n.
- Email that goes through the **outbox** — a use case never blocks on SMTP, and a
  failed send retries instead of vanishing.

## 4. Responsibilities

- `NotificationService` (`INotificationProvider`): resolve template → render per
  locale → write the in-app row → enqueue email (outbox) as requested by
  `channels`.
- `TemplateRepository` — `notification_templates` (key, locale, subject, body).
- `NotificationRepository` — `notifications` (the in-app inbox: read/unread).
- `email-channel` (`EMAIL_CHANNEL`) — `nodemailer` transport (or a log transport
  when no SMTP configured).
- Subscribers (`OnModuleInit`) mapping identity events → notifications.
- HTTP: list, mark-one-read, mark-all-read.

## 5. What it owns

Tables: `notifications`, `notification_templates`
(`prisma/schema/notifications.prisma`). The `NotificationPayload` shape. The
channel abstraction. The seed set of platform templates (verification, reset,
welcome).

## 6. What it explicitly does NOT own

- **Product event → notification mapping.** Mizan decides "a scheduled hearing
  notifies the lead lawyer" by subscribing to its own `hearing.scheduled` event
  and calling `send()`. Core only ships the platform-event subscribers.
- **Push / SMS** — not in v0.1; a channel is added when a project needs it.
- **Real-time transport to the web client** (SSE/WebSocket). The web polls
  `GET /api/notifications` today; a live channel is added per real need
  (Plan §33 — no speculative WebSockets).
- Digest/batching/quiet-hours logic — added when required.

## 7. Public surface

- `NotificationsModule` — exports token `NOTIFICATION_PROVIDER`
  (`INotificationProvider`) and `TemplateRepository`.
- HTTP (`/api/notifications`): `GET /` (`?unread`), `POST /:id/read`,
  `POST /read-all`. List envelope includes `unreadCount`.

## 8. How to use

```ts
constructor(@Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider) {}

// From a Mizan event subscriber:
await this.notify.send({
  userId: hearing.leadLawyerId,
  templateKey: "hearing.scheduled",
  type: "hearing.scheduled",
  channels: ["in_app"],
  data: { matter: hearing.matterTitle, court: hearing.court, at: hearing.scheduledAt },
});
```

Or pass a literal `title`/`body` instead of `templateKey` for one-offs.

## 9. Dependencies & direction

Imports `EventsModule` (subscribe + outbox), `IdentityModule` (recipient locale).
Consumed by any module that notifies users. Notifications imports no domain
module.

## 10. Invariants

1. Email delivery is **out-of-band via the outbox** — `send()` returns without
   waiting for SMTP; failures retry, then dead-letter.
2. Content is resolved for the recipient's locale (fallback: org default → `ar`).
3. The in-app row is written in the caller's transaction when `send()` runs
   inside one; the email side effect fires only on commit.
4. Template keys are stable identifiers.
5. Notifications are tenant-scoped where they concern tenant entities (carry org
   context; flag before allowing cross-tenant visibility — decision #16).

## 11. Example — platform vs product

```
core/notifications  subscribes to  email_verification.requested → sends the verify email
Mizan               subscribes to  hearing.scheduled            → notifies the lead lawyer
```

## 12. Testing expectations

`core/notifications/tests/` + `core/tests/`: template renders AR and EN;
`send()` writes the in-app row and enqueues (not sends) the email; the outbox
worker delivers once and retries on transport failure; mark-read flips unread
count; a rolled-back caller leaves no notification.

## 13. When NOT to extend it

- To add push/SMS/Slack before a project requires that channel.
- To add a WebSocket/SSE transport speculatively.
- To encode product notification rules in Core — subscribe from the product.
