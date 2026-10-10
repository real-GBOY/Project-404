import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { newTicketId, ticketTokenHash, ticketToken } from "@admit/admit/shared/secrets.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";
import { BookingsRepository, type BookingRecord } from "@admit/admit/bookings/infrastructure/bookings-repository.js";
import { TicketsRepository, type TicketRecord } from "../infrastructure/tickets-repository.js";

export interface TicketView {
  id: string;
  bookingRef: string;
  eventId: string;
  eventTitle: string;
  ticketType: string;
  holderName: string;
  seq: number;
  status: TicketRecord["status"];
  checkedInAt: Date | null;
  checkedInGate: string | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

/**
 * Ticket issuance and revocation. Issuance is only ever reached from payment approval (same transaction), is idempotent per
 * booking, and creates one ticket per seat - never one QR for a party. A ticket view never contains its QR token.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly repo: TicketsRepository,
    private readonly bookings: BookingsRepository,
    private readonly events: EventsRepository,
    private readonly access: EventAccess,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Must run inside the approval transaction. Re-running it for the same booking creates nothing new. */
  async issueForBooking(booking: BookingRecord): Promise<number> {
    const lines = await this.bookings.lines([booking.id]);
    const rows: Array<{ id: string; bookingId: string; eventId: string; ticketTypeId: string; seq: number; holderName: string; tokenHash: string }> = [];
    let seq = 1;
    for (const line of [...lines].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))) {
      for (let i = 0; i < line.quantity; i++) {
        const id = newTicketId();
        rows.push({
          id,
          bookingId: booking.id,
          eventId: booking.eventId,
          ticketTypeId: line.ticketTypeId,
          seq: seq++,
          holderName: line.holderNames[i] || booking.customerName,
          tokenHash: ticketTokenHash(id),
        });
      }
    }
    return this.repo.insertMany(rows);
  }

  private async views(tickets: TicketRecord[]): Promise<TicketView[]> {
    const [bookings, events, types] = await Promise.all([
      this.bookings.byIds([...new Set(tickets.map((t) => t.bookingId))]),
      Promise.all([...new Set(tickets.map((t) => t.eventId))].map((id) => this.events.findEvent(id))),
      this.events.listTypes([...new Set(tickets.map((t) => t.eventId))]),
    ]);
    const bk = new Map(bookings.map((b) => [b.id, b.ref]));
    const ev = new Map(events.filter((e) => !!e).map((e) => [e!.id, e!.title]));
    const tn = new Map(types.map((t) => [t.id, t.name]));
    return tickets.map((t) => ({
      id: t.id,
      bookingRef: bk.get(t.bookingId) ?? "",
      eventId: t.eventId,
      eventTitle: ev.get(t.eventId) ?? "",
      ticketType: tn.get(t.ticketTypeId) ?? "",
      holderName: t.holderName,
      seq: t.seq,
      status: t.status,
      checkedInAt: t.checkedInAt,
      checkedInGate: t.checkedInGate,
      revokedAt: t.revokedAt,
      revokedReason: t.revokedReason,
    }));
  }

  async countFor(bookingId: string): Promise<number> {
    return (await this.repo.forBookings([bookingId])).filter((t) => t.status !== "REVOKED").length;
  }

  /** Staff lookup, limited to the caller's events. `q` matches holder name or ticket id. */
  async search(who: Principal, q: { eventId?: string; q?: string; limit: number; offset: number }): Promise<TicketView[]> {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      if (q.eventId && scope && !scope.includes(q.eventId)) return [];
      return this.views(await this.repo.search({ eventIds: scope, eventId: q.eventId, q: q.q, limit: q.limit, offset: q.offset }));
    });
  }

  async get(who: Principal, id: string): Promise<TicketView> {
    return readInTenant(async () => {
      const t = await this.repo.find(id);
      if (!t) throw NotFound("admit.ticket_not_found", "Ticket not found.");
      await this.access.assertEvent(who, t.eventId);
      return (await this.views([t]))[0]!;
    });
  }

  /** Organizer action: refund, holder change, fraud. The scan endpoint rejects a revoked token from the next scan on. */
  async revoke(who: Principal, id: string, reason: string): Promise<TicketView> {
    return this.uow.transaction(async () => {
      const t = await this.repo.find(id);
      if (!t) throw NotFound("admit.ticket_not_found", "Ticket not found.");
      await this.access.assertEvent(who, t.eventId);
      if (t.status === "REVOKED") throw Conflict("admit.ticket_already_revoked", "This ticket is already revoked.");
      if (t.status === "USED") throw Conflict("admit.ticket_used", "This ticket has already been used to enter.");
      if (!(await this.repo.revoke(id, this.clock.now(), who.userId, reason)))
        throw Conflict("admit.ticket_changed", "This ticket just changed. Reload and try again.");
      await this.bookings.addTimeline(t.bookingId, "Ticket revoked", { actorId: who.userId, note: reason });
      await this.audit.record({
        actorId: who.userId,
        action: "admit.ticket.revoked",
        resourceType: "admit_ticket",
        resourceId: id,
        before: { status: t.status },
        after: { status: "REVOKED", reason },
      });
      return (await this.views([(await this.repo.find(id))!]))[0]!;
    });
  }

  /** The QR payload of a ticket - only ever handed to the image renderer, never to JSON. */
  qrPayload(ticketId: string): string {
    return ticketToken(ticketId);
  }

  assertReason(reason: string): void {
    if (reason.trim().length < 3) throw ValidationError("admit.reason_required", "Give a short reason.");
  }
}
