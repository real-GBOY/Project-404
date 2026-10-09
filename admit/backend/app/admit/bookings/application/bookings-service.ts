import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { readAdmitConfig } from "@admit/config.js";
import { isUniqueViolation } from "@admit/admit/shared/pg-errors.js";
import { admitId } from "@admit/admit/shared/ids.js";
import { accessSecretHash, newBookingRef, safeEqualHex, sha256Hex } from "@admit/admit/shared/secrets.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository, type EventRecord, type PaymentMethodRecord } from "@admit/admit/events/infrastructure/events-repository.js";
import { TicketsRepository } from "@admit/admit/tickets/infrastructure/tickets-repository.js";
import { PaymentsRepository } from "@admit/admit/payments/infrastructure/payments-repository.js";
import { EmailRepository } from "@admit/admit/emails/infrastructure/email-repository.js";
import { EmailComposer } from "@admit/admit/emails/application/email-composer.js";
import { BookingsRepository, type BookingRecord, type BookingStatus } from "../infrastructure/bookings-repository.js";
import type { CreateBookingBody } from "../validation/bookings.schema.js";

export interface BookingLineView {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

/** What a guest sees of their own booking (status page). */
export interface GuestBookingView {
  ref: string;
  status: BookingStatus;
  event: { id: string; slug: string; title: string; startsAt: Date; endsAt: Date; venue: { name: string; area: string; address: string; mapUrl: string | null }; coverUrl: string | null; namedTickets: boolean };
  customer: { name: string; emailMasked: string };
  lines: BookingLineView[];
  totalMinor: number;
  currency: string;
  holdExpiresAt: Date;
  rejectionReason: string | null;
  canResubmit: boolean;
  /** The instructions to pay with; only while the booking can still be paid. */
  paymentMethods: Array<Pick<PaymentMethodRecord, "id" | "type" | "label" | "recipientName" | "identifier" | "instructions">>;
  timeline: Array<{ step: string; state: string; at: Date; note: string | null }>;
  ticketCount: number;
  emailStatus: string | null;
}

/** What staff see: the guest view's facts plus contact details, submissions, tickets and emails. */
export interface AdminBookingSummary {
  id: string;
  ref: string;
  status: BookingStatus;
  eventId: string;
  eventTitle: string;
  customerName: string;
  email: string;
  phone: string;
  totalMinor: number;
  currency: string;
  ticketCount: number;
  holdExpiresAt: Date;
  version: number;
  createdAt: Date;
}

const maskEmail = (e: string): string => {
  const [u = "", d = ""] = e.split("@");
  return `${u.slice(0, 1)}${"*".repeat(Math.max(u.length - 1, 2))}@${d}`;
};

/**
 * The booking lifecycle: guest checkout with an inventory hold, the guest's magic-link access, cancellation, and
 * the sweep that releases lapsed holds. Seats are protected by a row lock on the ticket types being bought: two
 * concurrent bookings of the same type are serialised, the second sees the first's hold, and an oversell is
 * impossible - there is no stored counter to drift.
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly events: EventsRepository,
    private readonly tickets: TicketsRepository,
    private readonly payments: PaymentsRepository,
    private readonly emails: EmailRepository,
    private readonly composer: EmailComposer,
    private readonly access: EventAccess,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ---- guest checkout -------------------------------------------------------------------------
  /** Runs inside the organizer's tenant context (see PublicService). Returns the new booking and its magic-link secret. */
  async create(eventSlug: string, b: CreateBookingBody, idempotencyKey: string | null): Promise<{ booking: BookingRecord; created: boolean }> {
    const key = idempotencyKey ? sha256Hex(`${eventSlug}:${idempotencyKey}`).slice(0, 48) : null;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.uow.transaction(() => this.createOnce(eventSlug, b, key));
      } catch (err) {
        if (isUniqueViolation(err, "admit_bookings_ref_uq") && attempt < 4) continue; // a ref collision: draw another
        if (key && isUniqueViolation(err, "admit_bookings_idem_uq")) {
          const original = await readInTenant(() => this.repo.findByIdempotencyKey(key));
          if (original) return { booking: original, created: false };
        }
        throw err;
      }
    }
  }

  private async createOnce(eventSlug: string, b: CreateBookingBody, key: string | null): Promise<{ booking: BookingRecord; created: boolean }> {
    if (key) {
      const original = await this.repo.findByIdempotencyKey(key);
      if (original) return { booking: original, created: false };
    }
    const now = this.clock.now();
    const event = await this.events.findEventBySlug(eventSlug);
    if (!event || event.status !== "published") throw NotFound("admit.event_not_found", "This event is not on sale.");
    if (event.endsAt <= now) throw Conflict("admit.event_ended", "This event has already ended.");

    const items = this.mergeItems(b.items);
    const total = items.reduce((n, i) => n + i.quantity, 0);
    if (total < 1 || total > event.maxPerBooking) {
      throw ValidationError("admit.quantity", `Choose between 1 and ${event.maxPerBooking} tickets.`, { fields: [{ path: "items", message: `Choose between 1 and ${event.maxPerBooking} tickets.` }] });
    }
    if (Object.keys(event.policies).length && !b.policyAck) {
      throw ValidationError("admit.policy_ack", "Please confirm you've read the event policies.", { fields: [{ path: "policyAck", message: "Please confirm you've read the event policies." }] });
    }

    // Lock the ticket types first (id order), THEN count what is held: this is what makes overselling impossible.
    const types = await this.events.lockTypes(items.map((i) => i.ticketTypeId));
    const byId = new Map(types.filter((t) => t.eventId === event.id).map((t) => [t.id, t]));
    const held = await this.events.heldByType([event.id]);

    const lines = items.map((i) => {
      const t = byId.get(i.ticketTypeId);
      if (!t || !t.onSale) throw ValidationError("admit.ticket_type_unavailable", "One of the selected ticket types is not on sale.", { fields: [{ path: "items", message: "One of the selected ticket types is not on sale." }] });
      if (i.quantity > t.maxPerBooking) throw ValidationError("admit.quantity", `At most ${t.maxPerBooking} ${t.name} tickets per booking.`, { fields: [{ path: "items", message: `At most ${t.maxPerBooking} ${t.name} tickets per booking.` }] });
      const left = Math.max(t.quantity - (held.get(t.id) ?? 0), 0);
      if (i.quantity > left) {
        throw Conflict("admit.sold_out", left === 0 ? `${t.name} is sold out.` : `Only ${left} ${t.name} tickets are left.`, { ticketTypeId: t.id, remaining: left });
      }
      const names = event.namedTickets ? this.holderNames(i.holderNames, i.quantity) : i.holderNames?.slice(0, i.quantity) ?? [];
      return { ticketTypeId: t.id, quantity: i.quantity, unitPriceMinor: t.priceMinor, holderNames: names };
    });

    const id = admitId("bkg");
    const ref = newBookingRef();
    const holdExpiresAt = new Date(now.getTime() + event.holdHours * 3_600_000);
    await this.repo.insert({
      id, eventId: event.id, ref, accessHash: accessSecretHash(id), customerName: b.customer.name, email: b.customer.email.toLowerCase(), phone: b.customer.phone,
      totalMinor: lines.reduce((n, l) => n + l.quantity * l.unitPriceMinor, 0), currency: event.currency, holdExpiresAt, policyAck: b.policyAck, idempotencyKey: key,
    });
    await this.repo.insertLines(id, lines);
    await this.repo.addTimeline(id, "Booking created", { at: now });
    await this.repo.addTimeline(id, "Waiting for payment", { state: "pending", at: now });
    await this.composer.instructions(id);
    await this.audit.record({ actorId: null, actorType: "system", action: "admit.booking.created", resourceType: "admit_booking", resourceId: id, after: { ref, eventId: event.id, total } });
    return { booking: (await this.repo.find(id))!, created: true };
  }

  private mergeItems(items: CreateBookingBody["items"]): CreateBookingBody["items"] {
    const merged = new Map<string, CreateBookingBody["items"][number]>();
    for (const i of items) {
      const prev = merged.get(i.ticketTypeId);
      if (!prev) merged.set(i.ticketTypeId, { ...i });
      else merged.set(i.ticketTypeId, { ...prev, quantity: prev.quantity + i.quantity, holderNames: [...(prev.holderNames ?? []), ...(i.holderNames ?? [])] });
    }
    return [...merged.values()];
  }

  private holderNames(names: string[] | undefined, quantity: number): string[] {
    const fields: Array<{ path: string; message: string }> = [];
    const out: string[] = [];
    for (let n = 0; n < quantity; n++) {
      const v = names?.[n]?.trim();
      if (!v || v.length < 2) fields.push({ path: `items.holderNames.${n}`, message: `Add a name for ticket ${n + 1}.` });
      else out.push(v);
    }
    if (fields.length) throw ValidationError("admit.holder_names", "Add a name for every ticket.", { fields });
    return out;
  }

  // ---- guest access ---------------------------------------------------------------------------
  /**
   * Resolve a booking from its ref AND its magic-link secret. Both a wrong ref and a wrong secret answer the same
   * "not found", so a ref cannot be probed. An old link answers 403 `admit.link_expired` so the page can offer a new one.
   */
  async guest(ref: string, secret: string): Promise<{ booking: BookingRecord; event: EventRecord }> {
    const booking = await this.repo.findByRef(ref.toUpperCase());
    const ok = !!booking && !!secret && safeEqualHex(sha256Hex(secret), booking.accessHash);
    if (!booking || !ok) throw NotFound("admit.booking_not_found", "We couldn't find that booking.");
    const event = (await this.events.findEvent(booking.eventId))!;
    const days = readAdmitConfig().accessLinkDays * 86_400_000;
    const validUntil = Math.max(booking.createdAt.getTime() + days, event.endsAt.getTime());
    if (this.clock.now().getTime() > validUntil) throw Forbidden("admit.link_expired", "This link has expired. Request a new one by email.");
    return { booking, event };
  }

  async guestView(ref: string, secret: string): Promise<GuestBookingView> {
    return readInTenant(async () => {
      const { booking, event } = await this.guest(ref, secret);
      return this.toGuestView(booking, event);
    });
  }

  async toGuestView(booking: BookingRecord, event: EventRecord): Promise<GuestBookingView> {
    const [lines, types, timeline, venue, tickets, emails, methods] = await Promise.all([
      this.repo.lines([booking.id]),
      this.events.listTypes([event.id]),
      this.repo.timeline(booking.id),
      this.events.venuesByIds([event.venueId]),
      this.tickets.forBookings([booking.id]),
      this.emails.forBookings([booking.id]),
      booking.status === "AWAITING_PAYMENT" || booking.status === "IN_REVIEW" ? this.events.listMethods([event.id], true) : Promise.resolve([] as PaymentMethodRecord[]),
    ]);
    const tn = new Map(types.map((t) => [t.id, t.name]));
    const v = venue.get(event.venueId)!;
    const now = this.clock.now();
    const lastTicketEmail = [...emails].reverse().find((e) => e.type === "TICKETS");
    return {
      ref: booking.ref,
      status: booking.status,
      event: { id: event.id, slug: event.slug, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, venue: { name: v.name, area: v.area, address: v.address, mapUrl: v.mapUrl }, coverUrl: event.coverUrl, namedTickets: event.namedTickets },
      customer: { name: booking.customerName, emailMasked: maskEmail(booking.email) },
      lines: lines.map((l) => ({ ticketTypeId: l.ticketTypeId, name: tn.get(l.ticketTypeId) ?? "Ticket", quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.quantity * l.unitPriceMinor })),
      totalMinor: booking.totalMinor,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      rejectionReason: booking.status === "AWAITING_PAYMENT" || booking.status === "REJECTED" ? booking.rejectionReason : null,
      canResubmit: booking.status === "AWAITING_PAYMENT" && booking.holdExpiresAt > now,
      paymentMethods: methods.map((m) => ({ id: m.id, type: m.type, label: m.label, recipientName: m.recipientName, identifier: m.identifier, instructions: m.instructions })),
      timeline: timeline.map((t) => ({ step: t.step, state: t.state, at: t.at, note: t.state === "failed" ? t.note : null })),
      ticketCount: tickets.filter((t) => t.status !== "REVOKED").length,
      emailStatus: lastTicketEmail?.status ?? null,
    };
  }

  /** A customer may walk away before paying. After proof is in, only the organizer can cancel. */
  async cancelByGuest(ref: string, secret: string): Promise<GuestBookingView> {
    return this.uow.transaction(async () => {
      const { booking: seen } = await this.guest(ref, secret);
      const booking = (await this.repo.lock(seen.id))!;
      if (booking.status === "CANCELLED") {
        const event = (await this.events.findEvent(booking.eventId))!;
        return this.toGuestView(booking, event);
      }
      if (booking.status !== "AWAITING_PAYMENT") throw Conflict("admit.booking_state", "This booking can no longer be cancelled here. Contact the organizer.");
      await this.cancelLocked(booking, null, "Cancelled by customer");
      const event = (await this.events.findEvent(booking.eventId))!;
      return this.toGuestView((await this.repo.find(booking.id))!, event);
    });
  }

  /** Customer asked for a fresh link; always answers the same so it cannot be used to learn which refs/emails exist. */
  async resendLink(ref: string, email: string, requestId: string): Promise<void> {
    await this.uow.transaction(async () => {
      const booking = await this.repo.findByRef(ref.toUpperCase());
      if (!booking || booking.email !== email.toLowerCase()) return;
      await this.composer.magicLink(booking.id, requestId);
    });
  }

  // ---- organizer ------------------------------------------------------------------------------
  async list(who: Principal, f: { eventId?: string; status?: BookingStatus[]; search?: string; limit: number; offset: number }): Promise<{ items: AdminBookingSummary[]; total: number }> {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      if (f.eventId && scope && !scope.includes(f.eventId)) return { items: [], total: 0 };
      const { items, total } = await this.repo.list({ eventIds: scope, ...f });
      const [events, lines, tickets] = await Promise.all([
        Promise.all([...new Set(items.map((b) => b.eventId))].map((id) => this.events.findEvent(id))),
        this.repo.lines(items.map((b) => b.id)),
        this.tickets.forBookings(items.map((b) => b.id)),
      ]);
      const title = new Map(events.filter((e) => !!e).map((e) => [e!.id, e!.title]));
      return {
        total,
        items: items.map((b) => ({
          id: b.id, ref: b.ref, status: b.status, eventId: b.eventId, eventTitle: title.get(b.eventId) ?? "", customerName: b.customerName, email: b.email, phone: b.phone,
          totalMinor: b.totalMinor, currency: b.currency, ticketCount: b.status === "CONFIRMED" ? tickets.filter((t) => t.bookingId === b.id && t.status !== "REVOKED").length : lines.filter((l) => l.bookingId === b.id).reduce((n, l) => n + l.quantity, 0),
          holdExpiresAt: b.holdExpiresAt, version: b.version, createdAt: b.createdAt,
        })),
      };
    });
  }

  /** Full detail for the booking drawer: facts, timeline, submissions, tickets, emails. Ticket tokens are never included. */
  async detail(who: Principal, id: string) {
    return readInTenant(async () => {
      const booking = await this.repo.find(id);
      if (!booking) throw NotFound("admit.booking_not_found", "Booking not found.");
      await this.access.assertEvent(who, booking.eventId);
      const event = (await this.events.findEvent(booking.eventId))!;
      const [lines, types, timeline, submissions, tickets, emails] = await Promise.all([
        this.repo.lines([id]),
        this.events.listTypes([event.id]),
        this.repo.timeline(id),
        this.payments.historyForBooking(id),
        this.tickets.forBookings([id]),
        this.emails.forBookings([id]),
      ]);
      const tn = new Map(types.map((t) => [t.id, t.name]));
      const canPayments = await this.access.can(who, "read", "payment");
      return {
        id: booking.id, ref: booking.ref, status: booking.status, version: booking.version,
        event: { id: event.id, title: event.title, startsAt: event.startsAt },
        customer: { name: booking.customerName, email: booking.email, phone: booking.phone },
        totalMinor: booking.totalMinor, currency: booking.currency, holdExpiresAt: booking.holdExpiresAt, rejectionReason: booking.rejectionReason,
        createdAt: booking.createdAt, confirmedAt: booking.confirmedAt, cancelledAt: booking.cancelledAt,
        lines: lines.map((l) => ({ ticketTypeId: l.ticketTypeId, name: tn.get(l.ticketTypeId) ?? "Ticket", quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.quantity * l.unitPriceMinor })),
        timeline: timeline.map((t) => ({ step: t.step, state: t.state, at: t.at, note: t.note, actorId: t.actorId })),
        submissions: canPayments
          ? submissions.map((s) => ({ id: s.id, status: s.status, txnId: s.txnId, sentFrom: s.sentFrom, amountMinor: s.amountMinor, createdAt: s.createdAt, decidedAt: s.decidedAt, decidedBy: s.decidedBy, customerReason: s.customerReason, internalNote: s.internalNote }))
          : [],
        tickets: tickets.map((t) => ({ id: t.id, seq: t.seq, holderName: t.holderName, ticketType: tn.get(t.ticketTypeId) ?? "", status: t.status, checkedInAt: t.checkedInAt, checkedInGate: t.checkedInGate, revokedAt: t.revokedAt, revokedReason: t.revokedReason })),
        emails: emails.map((e) => ({ id: e.id, type: e.type, status: e.status, attempts: e.attempts, lastError: e.lastError, sentAt: e.sentAt, createdAt: e.createdAt })),
      };
    });
  }

  async cancelByOrganizer(who: Principal, id: string, reason: string): Promise<void> {
    await this.uow.transaction(async () => {
      const seen = await this.repo.find(id);
      if (!seen) throw NotFound("admit.booking_not_found", "Booking not found.");
      await this.access.assertEvent(who, seen.eventId);
      const booking = (await this.repo.lock(id))!;
      if (booking.status === "CANCELLED") return;
      if (booking.status === "EXPIRED" || booking.status === "REJECTED") throw Conflict("admit.booking_state", `A ${booking.status.toLowerCase()} booking cannot be cancelled.`);
      if ((await this.tickets.forBookings([id])).some((t) => t.status === "USED")) {
        throw Conflict("admit.ticket_used", "Someone with this booking has already entered. Revoke individual tickets instead.");
      }
      await this.cancelLocked(booking, who.userId, reason);
    });
  }

  /** Cancel while holding the row lock: release the seats (cancellation is not a held status), revoke tickets, open submissions, tell the customer. */
  private async cancelLocked(booking: BookingRecord, actorId: string | null, reason: string): Promise<void> {
    const now = this.clock.now();
    if (!(await this.repo.transition(booking.id, ["AWAITING_PAYMENT", "IN_REVIEW", "CONFIRMED"], "CANCELLED", { cancelledAt: now }))) {
      throw Conflict("admit.booking_changed", "This booking just changed. Reload and try again.");
    }
    await this.payments.supersedeOpen(booking.id);
    const revoked = await this.tickets.revokeForBooking(booking.id, now, actorId, reason);
    await this.repo.addTimeline(booking.id, "Booking cancelled", { actorId, note: reason, at: now });
    await this.composer.cancelled(booking.id);
    await this.audit.record({ actorId, actorType: actorId ? "user" : "system", action: "admit.booking.cancelled", resourceType: "admit_booking", resourceId: booking.id, before: { status: booking.status }, after: { status: "CANCELLED", reason, revokedTickets: revoked } });
  }

  // ---- scheduled ------------------------------------------------------------------------------
  /**
   * Release holds that lapsed without proof. A booking IN_REVIEW is never expired (the organizer is the slow party), and
   * a lapsed hold is only taken with SKIP LOCKED so a customer uploading at the deadline wins the race cleanly.
   * Runs once per organization, inside that organization's tenant context.
   */
  async expireLapsedHolds(batch = 100): Promise<number> {
    return this.uow.transaction(async () => {
      const now = this.clock.now();
      const lapsed = await this.repo.lapsedHolds(now, batch);
      let n = 0;
      for (const b of lapsed) {
        if (!(await this.repo.transition(b.id, ["AWAITING_PAYMENT"], "EXPIRED"))) continue;
        await this.repo.addTimeline(b.id, "Hold expired", { state: "failed", at: now });
        await this.composer.expired(b.id);
        await this.audit.record({ actorId: null, actorType: "system", action: "admit.booking.expired", resourceType: "admit_booking", resourceId: b.id });
        n++;
      }
      return n;
    });
  }
}
