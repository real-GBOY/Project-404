import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { isUniqueViolation } from "@admit/admit/shared/pg-errors.js";
import { EventAccess } from "./event-access.js";
import { EventsRepository, type EventRecord, type PaymentMethodRecord, type TicketTypeRecord, type VenueRecord } from "../infrastructure/events-repository.js";
import type {
  CreateEventBody,
  PaymentMethodBody,
  PaymentMethodPatchBody,
  TicketTypeBody,
  TicketTypePatchBody,
  UpdateEventBody,
  VenueBody,
  VenuePatchBody,
} from "../validation/events.schema.js";

export interface TicketTypeView extends TicketTypeRecord {
  held: number;
  remaining: number;
}
export interface EventView extends Omit<EventRecord, "venueId"> {
  venue: VenueRecord;
  ticketTypes: TicketTypeView[];
  paymentMethods: PaymentMethodRecord[];
  capacityAllocated: number;
}

/** Admin side of the event catalogue: venues, events, ticket types and payment instructions. */
@Injectable()
export class EventsService {
  constructor(
    private readonly repo: EventsRepository,
    private readonly access: EventAccess,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ---- reads ----------------------------------------------------------------------------------
  /** Assemble full views (venue, types with live availability, payment methods) for events. Call inside a tenant transaction. */
  async assemble(events: EventRecord[]): Promise<EventView[]> {
    const ids = events.map((e) => e.id);
    const [venues, types, methods, held] = await Promise.all([
      this.repo.venuesByIds([...new Set(events.map((e) => e.venueId))]),
      this.repo.listTypes(ids),
      this.repo.listMethods(ids),
      this.repo.heldByType(ids),
    ]);
    return events.map((e) => {
      const { venueId, ...rest } = e;
      const myTypes = types
        .filter((t) => t.eventId === e.id)
        .map((t) => {
          const h = held.get(t.id) ?? 0;
          return { ...t, held: h, remaining: Math.max(t.quantity - h, 0) };
        });
      return {
        ...rest,
        venue: venues.get(venueId)!,
        ticketTypes: myTypes,
        paymentMethods: methods.filter((m) => m.eventId === e.id),
        capacityAllocated: myTypes.reduce((n, t) => n + t.quantity, 0),
      };
    });
  }

  async list(who: Principal): Promise<EventView[]> {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      return this.assemble(await this.repo.listEvents({ ids: scope }));
    });
  }

  async get(who: Principal, id: string): Promise<EventView> {
    return readInTenant(async () => {
      await this.access.assertEvent(who, id);
      const e = await this.repo.findEvent(id);
      if (!e) throw NotFound("admit.event_not_found", "Event not found.");
      return (await this.assemble([e]))[0]!;
    });
  }

  async venues(): Promise<VenueRecord[]> {
    return readInTenant(() => this.repo.listVenues());
  }

  // ---- venues ---------------------------------------------------------------------------------
  async createVenue(who: Principal, b: VenueBody): Promise<VenueRecord> {
    return this.uow.transaction(async () => {
      const id = await this.repo.insertVenue(b);
      await this.audit.record({ actorId: who.userId, action: "admit.venue.created", resourceType: "admit_venue", resourceId: id, after: b });
      return (await this.repo.findVenue(id))!;
    });
  }

  async updateVenue(who: Principal, id: string, b: VenuePatchBody): Promise<VenueRecord> {
    return this.uow.transaction(async () => {
      const before = await this.repo.findVenue(id);
      if (!before) throw NotFound("admit.venue_not_found", "Venue not found.");
      if (b.capacity !== undefined) await this.assertVenueFitsEvents(id, b.capacity);
      await this.repo.updateVenue(id, b);
      await this.audit.record({ actorId: who.userId, action: "admit.venue.updated", resourceType: "admit_venue", resourceId: id, before, after: b });
      return (await this.repo.findVenue(id))!;
    });
  }

  private async assertVenueFitsEvents(venueId: string, capacity: number): Promise<void> {
    const events = (await this.repo.listEvents({ ids: null })).filter((e) => e.venueId === venueId && e.status !== "archived" && e.status !== "cancelled");
    const types = await this.repo.listTypes(events.map((e) => e.id));
    for (const e of events) {
      const total = types.filter((t) => t.eventId === e.id).reduce((n, t) => n + t.quantity, 0);
      if (total > capacity) throw Conflict("admit.venue_capacity", `Event "${e.title}" already sells ${total} tickets, more than ${capacity}.`);
    }
  }

  // ---- events ---------------------------------------------------------------------------------
  async create(who: Principal, b: CreateEventBody): Promise<EventView> {
    try {
      return await this.uow.transaction(async () => {
        if (!(await this.repo.findVenue(b.venueId))) throw ValidationError("admit.venue_not_found", "Choose an existing venue.");
        const id = await this.repo.insertEvent(b, who.userId);
        await this.audit.record({
          actorId: who.userId,
          action: "admit.event.created",
          resourceType: "admit_event",
          resourceId: id,
          after: { slug: b.slug, title: b.title },
        });
        return (await this.assemble([(await this.repo.findEvent(id))!]))[0]!;
      });
    } catch (err) {
      throw this.translate(err, b.slug);
    }
  }

  async update(who: Principal, id: string, b: UpdateEventBody): Promise<EventView> {
    try {
      return await this.uow.transaction(async () => {
        await this.access.assertEvent(who, id);
        const before = await this.repo.findEvent(id);
        if (!before) throw NotFound("admit.event_not_found", "Event not found.");
        if (before.status === "archived") throw Conflict("admit.event_archived", "An archived event cannot be edited.");
        const startsAt = b.startsAt ?? before.startsAt;
        const endsAt = b.endsAt ?? before.endsAt;
        if (endsAt <= startsAt) throw ValidationError("admit.event_window", "End must be after start.");
        if (b.venueId && !(await this.repo.findVenue(b.venueId))) throw ValidationError("admit.venue_not_found", "Choose an existing venue.");
        if (b.slug && b.slug !== before.slug && before.status !== "draft") {
          throw Conflict("admit.slug_locked", "The address of a published event cannot change: customers may already hold links to it.");
        }
        if (b.venueId && b.venueId !== before.venueId) {
          const venue = (await this.repo.findVenue(b.venueId))!;
          const total = (await this.repo.listTypes([id])).reduce((n, t) => n + t.quantity, 0);
          if (total > venue.capacity) throw Conflict("admit.venue_capacity", `Ticket quantities exceed the venue capacity by ${total - venue.capacity}.`);
        }
        await this.repo.updateEvent(id, b);
        await this.audit.record({
          actorId: who.userId,
          action: "admit.event.updated",
          resourceType: "admit_event",
          resourceId: id,
          before: { title: before.title, slug: before.slug },
          after: b,
        });
        return (await this.assemble([(await this.repo.findEvent(id))!]))[0]!;
      });
    } catch (err) {
      throw this.translate(err, b.slug);
    }
  }

  /** Publishing is a promise to customers, so it checks the event can actually be bought. */
  async publish(who: Principal, id: string): Promise<EventView> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, id);
      const view = (await this.assemble(await this.requireEvents(id)))[0]!;
      if (view.status === "published") return view;
      if (view.status !== "draft") throw Conflict("admit.event_not_publishable", `A ${view.status} event cannot be published.`);
      if (view.endsAt <= this.clock.now()) throw ValidationError("admit.event_in_past", "This event has already ended.");
      const onSale = view.ticketTypes.filter((t) => t.onSale && t.quantity > 0);
      if (!onSale.length) throw ValidationError("admit.no_ticket_types", "Add at least one ticket type that is on sale.");
      if (!view.paymentMethods.some((m) => m.enabled))
        throw ValidationError("admit.no_payment_method", "Enable at least one payment method so customers know where to send money.");
      if (view.capacityAllocated > view.venue.capacity) {
        throw ValidationError("admit.venue_capacity", `Ticket quantities exceed the venue capacity by ${view.capacityAllocated - view.venue.capacity}.`);
      }
      await this.repo.setStatus(id, "published", this.clock.now());
      await this.audit.record({ actorId: who.userId, action: "admit.event.published", resourceType: "admit_event", resourceId: id });
      return (await this.assemble(await this.requireEvents(id)))[0]!;
    });
  }

  async unpublish(who: Principal, id: string): Promise<EventView> {
    return this.transition(who, id, "draft", "admit.event.unpublished", ["published"]);
  }
  async cancel(who: Principal, id: string): Promise<EventView> {
    return this.transition(who, id, "cancelled", "admit.event.cancelled", ["draft", "published"]);
  }
  async archive(who: Principal, id: string): Promise<EventView> {
    return this.transition(who, id, "archived", "admit.event.archived", ["draft", "cancelled", "published"]);
  }

  private async transition(who: Principal, id: string, to: "draft" | "cancelled" | "archived", action: string, from: string[]): Promise<EventView> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, id);
      const e = (await this.requireEvents(id))[0]!;
      if (!from.includes(e.status)) throw Conflict("admit.event_state", `An event that is ${e.status} cannot be moved to ${to}.`);
      await this.repo.setStatus(id, to, to === "draft" ? null : undefined);
      await this.audit.record({
        actorId: who.userId,
        action,
        resourceType: "admit_event",
        resourceId: id,
        before: { status: e.status },
        after: { status: to },
      });
      return (await this.assemble(await this.requireEvents(id)))[0]!;
    });
  }

  private async requireEvents(id: string): Promise<EventRecord[]> {
    const e = await this.repo.findEvent(id);
    if (!e) throw NotFound("admit.event_not_found", "Event not found.");
    return [e];
  }

  // ---- ticket types ---------------------------------------------------------------------------
  async createType(who: Principal, eventId: string, b: TicketTypeBody): Promise<TicketTypeView> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, eventId);
      const view = (await this.assemble(await this.requireEvents(eventId)))[0]!;
      this.assertEditable(view);
      this.assertCapacity(view, view.capacityAllocated + b.quantity);
      if (b.maxPerBooking > view.maxPerBooking) b = { ...b, maxPerBooking: view.maxPerBooking };
      const id = await this.repo.insertType(eventId, b);
      await this.audit.record({ actorId: who.userId, action: "admit.ticket_type.created", resourceType: "admit_ticket_type", resourceId: id, after: b });
      return (await this.assemble(await this.requireEvents(eventId)))[0]!.ticketTypes.find((t) => t.id === id)!;
    });
  }

  async updateType(who: Principal, typeId: string, b: TicketTypePatchBody): Promise<TicketTypeView> {
    return this.uow.transaction(async () => {
      const [locked] = await this.repo.lockTypes([typeId]);
      if (!locked) throw NotFound("admit.ticket_type_not_found", "Ticket type not found.");
      await this.access.assertEvent(who, locked.eventId);
      const view = (await this.assemble(await this.requireEvents(locked.eventId)))[0]!;
      this.assertEditable(view);
      const current = view.ticketTypes.find((t) => t.id === typeId)!;
      if (b.quantity !== undefined) {
        if (b.quantity < current.held)
          throw Conflict("admit.quantity_below_sold", `${current.held} tickets are already booked or held; the quantity cannot go below that.`);
        this.assertCapacity(view, view.capacityAllocated - current.quantity + b.quantity);
      }
      await this.repo.updateType(typeId, b);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.ticket_type.updated",
        resourceType: "admit_ticket_type",
        resourceId: typeId,
        before: { priceMinor: current.priceMinor, quantity: current.quantity },
        after: b,
      });
      return (await this.assemble(await this.requireEvents(locked.eventId)))[0]!.ticketTypes.find((t) => t.id === typeId)!;
    });
  }

  async deleteType(who: Principal, typeId: string): Promise<void> {
    await this.uow.transaction(async () => {
      const t = await this.repo.findType(typeId);
      if (!t) throw NotFound("admit.ticket_type_not_found", "Ticket type not found.");
      await this.access.assertEvent(who, t.eventId);
      if (await this.repo.typeHasBookings(typeId))
        throw Conflict("admit.ticket_type_in_use", "This ticket type has bookings. Take it off sale instead of deleting it.");
      await this.repo.deleteType(typeId);
      await this.audit.record({ actorId: who.userId, action: "admit.ticket_type.deleted", resourceType: "admit_ticket_type", resourceId: typeId, before: t });
    });
  }

  // ---- payment methods ------------------------------------------------------------------------
  async createMethod(who: Principal, eventId: string, b: PaymentMethodBody): Promise<PaymentMethodRecord> {
    return this.uow.transaction(async () => {
      await this.access.assertEvent(who, eventId);
      this.assertEditable((await this.assemble(await this.requireEvents(eventId)))[0]!);
      const id = await this.repo.insertMethod(eventId, b);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.payment_method.created",
        resourceType: "admit_payment_method",
        resourceId: id,
        after: { type: b.type, label: b.label },
      });
      return (await this.repo.findMethod(id))!;
    });
  }

  async updateMethod(who: Principal, id: string, b: PaymentMethodPatchBody): Promise<PaymentMethodRecord> {
    return this.uow.transaction(async () => {
      const m = await this.repo.findMethod(id);
      if (!m) throw NotFound("admit.payment_method_not_found", "Payment method not found.");
      await this.access.assertEvent(who, m.eventId);
      await this.repo.updateMethod(id, b);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.payment_method.updated",
        resourceType: "admit_payment_method",
        resourceId: id,
        after: { ...b, identifier: b.identifier ? "(changed)" : undefined },
      });
      return (await this.repo.findMethod(id))!;
    });
  }

  async deleteMethod(who: Principal, id: string): Promise<void> {
    await this.uow.transaction(async () => {
      const m = await this.repo.findMethod(id);
      if (!m) throw NotFound("admit.payment_method_not_found", "Payment method not found.");
      await this.access.assertEvent(who, m.eventId);
      if (await this.repo.methodInUse(id))
        throw Conflict("admit.payment_method_in_use", "Customers have already paid with this method. Disable it instead of deleting it.");
      await this.repo.deleteMethod(id);
      await this.audit.record({ actorId: who.userId, action: "admit.payment_method.deleted", resourceType: "admit_payment_method", resourceId: id });
    });
  }

  // ---- rules ----------------------------------------------------------------------------------
  private assertEditable(view: EventView): void {
    if (view.status === "archived" || view.status === "cancelled") throw Conflict("admit.event_state", `A ${view.status} event cannot be changed.`);
  }

  private assertCapacity(view: EventView, total: number): void {
    if (total > view.venue.capacity) {
      throw ValidationError("admit.venue_capacity", `Ticket quantities exceed the venue capacity by ${total - view.venue.capacity}.`);
    }
  }

  private translate(err: unknown, slug?: string): unknown {
    if (isUniqueViolation(err, "admit_events_slug_uq")) return Conflict("admit.slug_taken", `The address "${slug}" is already used by another event.`);
    return err;
  }
}
