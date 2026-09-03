import type { EventRegistry } from "@core/events/registry.js";
import { IdentityEvents } from "@core/identity/events/events.js";
import {
  NotificationService,
  NotificationEvents,
} from "@core/notifications/application/notification-service.js";

/**
 * Wires the Notifications module's reactions to events from other modules.
 * Kept in one place so it is obvious what triggers a notification (§3.3
 * "clear workflows").
 *
 *  - email sends are EXTERNAL effects → registered with `onExternal`, routed
 *    through the outbox with retries + DLQ.
 *  - the in-app welcome note is a DB-only effect → `onInProcess`, committed in
 *    the same transaction as the registration.
 */
export function registerNotificationSubscribers(
  registry: EventRegistry,
  service: NotificationService,
): void {
  registry.onExternal(
    IdentityEvents.EmailVerificationRequested,
    "notifications.send_verification_email",
    (event) => service.onEmailVerificationRequested(event),
  );

  registry.onExternal(
    IdentityEvents.PasswordResetRequested,
    "notifications.send_reset_email",
    (event) => service.onPasswordResetRequested(event),
  );

  registry.onExternal(NotificationEvents.EmailRequested, "notifications.deliver_email", (event) =>
    service.deliverEmail(event),
  );

  registry.onInProcess(IdentityEvents.UserRegistered, (event) => service.onUserRegistered(event));
}
