import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { BookingsRepository } from "@admit/admit/bookings/infrastructure/bookings-repository.js";
import { EmailRepository, type EmailStatus } from "../infrastructure/email-repository.js";

/** Delivery visibility and the retry action. The Python worker owns sending; staff only watch and re-queue a FAILED message. */
@Injectable()
export class EmailsService {
  constructor(
    private readonly repo: EmailRepository,
    private readonly bookings: BookingsRepository,
    private readonly access: EventAccess,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(who: Principal, f: { status?: EmailStatus[]; bookingId?: string; limit: number; offset: number }) {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      const rows = await this.repo.list({ eventIds: scope, ...f });
      const bookings = await this.bookings.byIds([...new Set(rows.map((r) => r.bookingId).filter((v): v is string => !!v))]);
      const ref = new Map(bookings.map((b) => [b.id, b.ref]));
      return {
        items: rows.map((r) => ({
          id: r.id,
          at: r.createdAt,
          to: r.toEmail,
          type: r.type,
          bookingRef: r.bookingId ? (ref.get(r.bookingId) ?? null) : null,
          status: r.status,
          attempts: r.attempts,
          maxAttempts: r.maxAttempts,
          lastError: r.lastError,
          providerMessageId: r.providerMessageId,
          sentAt: r.sentAt,
        })),
        failedCount: await this.repo.countFailed(),
      };
    });
  }

  async retry(who: Principal, id: string): Promise<void> {
    await this.uow.transaction(async () => {
      const e = await this.repo.find(id);
      if (!e) throw NotFound("admit.email_not_found", "Email not found.");
      if (e.bookingId) {
        const b = await this.bookings.find(e.bookingId);
        if (b) await this.access.assertEvent(who, b.eventId);
      }
      if (!(await this.repo.requeueFailed(id))) throw Conflict("admit.email_not_failed", "Only a failed email can be retried.");
      await this.audit.record({ actorId: who.userId, action: "admit.email.retried", resourceType: "admit_email_message", resourceId: id });
    });
  }
}
