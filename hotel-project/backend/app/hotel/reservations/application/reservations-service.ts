import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { daysBetween, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { isExclusionViolation } from "@hotel/hotel/shared/pg-errors.js";
import { withSavepoint } from "@hotel/hotel/shared/savepoint.js";
import { GuestsRepository } from "@hotel/hotel/guests/infrastructure/guests-repository.js";
import { RoomTypesRepository } from "@hotel/hotel/rooms/infrastructure/room-types-repository.js";
import { RoomsRepository } from "@hotel/hotel/rooms/infrastructure/rooms-repository.js";
import { PricingService } from "@hotel/hotel/pricing/application/pricing-service.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import {
  availableCommands,
  MODIFIABLE,
  transition,
  type ReservationCommand,
  type ReservationStatus,
} from "../domain/reservation-state.js";
import {
  ReservationsRepository,
  type ReservationFilter,
  type ReservationRecord,
  type ReservationSource,
} from "../infrastructure/reservations-repository.js";
import {
  reservationCancelled,
  reservationChanged,
  reservationCheckedIn,
  reservationCheckedOut,
  reservationConfirmed,
  reservationCreated,
  reservationNoShow,
  type ReservationEventPayload,
} from "../events/reservation.events.js";

export const MAX_NIGHTS = 30;
/**
 * Auto-assignment re-reads the free rooms each round (each read sees rooms that concurrent
 * bookings have just committed), so it only reports "sold out" when no room is actually free.
 * The round cap only bounds pathological contention.
 */
const MAX_ALLOCATION_ROUNDS = 5;

export interface CreateReservationInput {
  guestId: string;
  roomTypeId: string;
  /** Specific room; omitted = the system assigns one. */
  roomId?: string | null;
  arrival: IsoDate;
  departure: IsoDate;
  adults: number;
  children: number;
  source: ReservationSource;
  notes?: string | null;
  discountCode?: string | null;
  /** Confirm immediately (a phone or front-desk booking); otherwise the booking stays pending. */
  confirm?: boolean;
}

/**
 * The reservation engine. Every write is one transaction that (1) row-locks the reservation,
 * (2) asks the pure state machine whether the change is legal, (3) applies the change and its
 * inventory side effect, (4) writes status history, a Core audit record and a domain event.
 *
 * Inventory is never checked-then-written: the room is claimed by INSERTing an allocation, and
 * the database's exclusion constraint rejects any overlap — including one created by a
 * concurrent request a millisecond earlier. Prices are always quoted here, server-side.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly repo: ReservationsRepository,
    private readonly guests: GuestsRepository,
    private readonly roomTypes: RoomTypesRepository,
    private readonly rooms: RoomsRepository,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly directory: UserDirectory,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ─── reads ────────────────────────────────────────────────────────────────

  list(filter: ReservationFilter) {
    return readInTenant(() => this.repo.list(filter));
  }

  async get(id: string) {
    return readInTenant(async () => {
      const r = await this.repo.findById(id);
      if (!r) throw NotFound("reservation.not_found", "Reservation not found.");
      const history = await this.repo.history(id);
      const names = await this.directory.userNames(history.map((h) => h.actorId));
      return {
        ...r,
        commands: availableCommands(r.status),
        history: history.map((h) => ({
          ...h,
          actorName: h.actorId ? (names.get(h.actorId) ?? "—") : "System",
        })),
      };
    });
  }

  // ─── create ───────────────────────────────────────────────────────────────

  create(input: CreateReservationInput, actorId: string): Promise<ReservationRecord> {
    return this.uow.transaction(async () => {
      const today = await this.settings.today();
      this.validateStay(input.arrival, input.departure, today);

      const guest = await this.guests.findById(input.guestId);
      if (!guest) throw ValidationError("reservation.unknown_guest", "That guest does not exist.");
      const type = await this.roomTypes.findById(input.roomTypeId);
      if (!type || type.archivedAt) {
        throw ValidationError("reservation.unknown_room_type", "That room type does not exist.");
      }
      if (input.adults + input.children > type.capacity) {
        throw ValidationError(
          "reservation.over_capacity",
          `${type.name} sleeps at most ${type.capacity} guests.`,
        );
      }

      const quote = await this.pricing.quote({
        roomTypeId: type.id,
        arrival: input.arrival,
        departure: input.departure,
        discountCode: input.discountCode,
      });

      const id = await this.repo.insert({
        code: await this.repo.nextCode(),
        guestId: guest.id,
        roomTypeId: type.id,
        status: "pending",
        source: input.source,
        arrival: input.arrival,
        departure: input.departure,
        adults: input.adults,
        children: input.children,
        nightlyRates: quote.nights,
        roomTotal: quote.roomTotal,
        discountCode: quote.discountCode,
        discountAmount: quote.discountAmount,
        total: quote.total,
        notes: input.notes ?? null,
        createdBy: actorId,
      });

      await this.allocate(id, type.id, input.arrival, input.departure, input.roomId ?? null);
      await this.repo.addHistory(id, null, "pending", actorId);

      let created = (await this.repo.findById(id))!;
      await this.audit.record({
        actorId,
        action: "hotel.reservation.created",
        resourceType: "hotel_reservation",
        resourceId: id,
        after: {
          code: created.code,
          roomId: created.roomId,
          arrival: created.arrival,
          departure: created.departure,
          total: created.total,
        },
      });
      await this.events.publish(
        reservationCreated({ ...this.payload(created, actorId), status: created.status }),
      );

      if (input.confirm) {
        created = await this.applyTransition(created, "confirm", actorId);
      }
      return created;
    });
  }

  // ─── lifecycle transitions ────────────────────────────────────────────────

  confirm(id: string, actorId: string) {
    return this.transitionById(id, "confirm", actorId);
  }

  cancel(id: string, reason: string | null, actorId: string) {
    return this.transitionById(id, "cancel", actorId, reason);
  }

  /** Only once the arrival date has come — you can't no-show a future booking. */
  noShow(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      const r = await this.lockAndLoad(id);
      const today = await this.settings.today();
      if (r.arrival > today) {
        throw Conflict(
          "reservation.no_show_too_early",
          "A guest can only be marked as a no-show on or after their arrival date.",
        );
      }
      return this.applyTransition(r, "no_show", actorId);
    });
  }

  // ─── modifications (pending / confirmed only) ─────────────────────────────

  /** Move the whole stay to another room of the same type. */
  changeRoom(id: string, roomId: string, actorId: string) {
    return this.uow.transaction(async () => {
      const r = await this.lockAndLoad(id);
      this.requireModifiable(r);
      if (r.roomId === roomId) return r;
      const room = await this.rooms.findById(roomId);
      if (!room || room.archivedAt) {
        throw ValidationError("reservation.unknown_room", "That room does not exist.");
      }
      if (room.roomTypeId !== r.roomTypeId) {
        throw ValidationError(
          "reservation.room_type_mismatch",
          `Room ${room.number} is not a ${r.roomTypeName}. Change the room type by rebooking.`,
        );
      }
      if (room.serviceStatus === "out_of_service") {
        throw Conflict("reservation.room_out_of_service", `Room ${room.number} is out of service.`);
      }
      try {
        await withSavepoint(() =>
          this.repo.reallocate(id, { roomId, arrival: r.arrival, departure: r.departure }),
        );
      } catch (err) {
        if (isExclusionViolation(err)) {
          throw Conflict(
            "reservation.room_unavailable",
            `Room ${room.number} is already booked for some of these nights.`,
          );
        }
        throw err;
      }
      const after = (await this.repo.findById(id))!;
      await this.audit.record({
        actorId,
        action: "hotel.reservation.room_changed",
        resourceType: "hotel_reservation",
        resourceId: id,
        before: { roomNumber: r.roomNumber },
        after: { roomNumber: after.roomNumber },
      });
      await this.events.publish(
        reservationChanged({ ...this.payload(after, actorId), change: "room", roomId }),
      );
      return after;
    });
  }

  /** New dates, re-priced server-side; keeps the room if it's free, otherwise another of the type. */
  changeDates(id: string, arrival: IsoDate, departure: IsoDate, actorId: string) {
    return this.uow.transaction(async () => {
      const r = await this.lockAndLoad(id);
      this.requireModifiable(r);
      const today = await this.settings.today();
      this.validateStay(arrival, departure, today);
      const quote = await this.pricing.quote({
        roomTypeId: r.roomTypeId,
        arrival,
        departure,
        discountCode: r.discountCode,
      });

      let roomId = r.roomId!;
      try {
        await withSavepoint(() => this.repo.reallocate(id, { roomId, arrival, departure }));
      } catch (err) {
        if (!isExclusionViolation(err)) throw err;
        roomId = await this.reallocateToAnyRoom(id, r.roomTypeId, arrival, departure);
      }
      await this.repo.updateStayAndPrice(id, {
        arrival,
        departure,
        nightlyRates: quote.nights,
        roomTotal: quote.roomTotal,
        discountAmount: quote.discountAmount,
        total: quote.total,
      });
      const after = (await this.repo.findById(id))!;
      await this.audit.record({
        actorId,
        action: "hotel.reservation.dates_changed",
        resourceType: "hotel_reservation",
        resourceId: id,
        before: { arrival: r.arrival, departure: r.departure, total: r.total, room: r.roomNumber },
        after: {
          arrival: after.arrival,
          departure: after.departure,
          total: after.total,
          room: after.roomNumber,
        },
      });
      await this.events.publish(
        reservationChanged({ ...this.payload(after, actorId), change: "dates", roomId }),
      );
      return after;
    });
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private transitionById(
    id: string,
    command: ReservationCommand,
    actorId: string,
    reason: string | null = null,
  ) {
    return this.uow.transaction(async () => {
      const r = await this.lockAndLoad(id);
      return this.applyTransition(r, command, actorId, reason);
    });
  }

  /**
   * The single transition path: state machine → status + side effect → history → audit → event.
   * Must run inside the caller's transaction with the reservation row already locked.
   */
  async applyTransition(
    r: ReservationRecord,
    command: ReservationCommand,
    actorId: string,
    reason: string | null = null,
    extra: { invoiceId?: string | null } = {},
  ): Promise<ReservationRecord> {
    const next: ReservationStatus = transition(r.status, command);
    const at = this.clock.now();
    await this.repo.setStatus(r.id, next, at, { cancellationReason: reason });
    if (next === "cancelled" || next === "no_show") {
      await this.repo.release(r.id);
    }
    await this.repo.addHistory(r.id, r.status, next, actorId, reason);
    await this.audit.record({
      actorId,
      action: `hotel.reservation.${command === "no_show" ? "no_show" : PAST[command]}`,
      resourceType: "hotel_reservation",
      resourceId: r.id,
      before: { status: r.status },
      after: { status: next, ...(reason ? { reason } : {}) },
    });
    const payload = this.payload(r, actorId);
    if (next === "confirmed") await this.events.publish(reservationConfirmed(payload));
    if (next === "cancelled")
      await this.events.publish(reservationCancelled({ ...payload, reason }));
    if (next === "no_show") await this.events.publish(reservationNoShow(payload));
    if (next === "checked_in") {
      await this.events.publish(reservationCheckedIn({ ...payload, roomId: r.roomId }));
    }
    if (next === "checked_out") {
      await this.events.publish(
        reservationCheckedOut({ ...payload, roomId: r.roomId, invoiceId: extra.invoiceId ?? null }),
      );
    }
    return (await this.repo.findById(r.id))!;
  }

  /** Lock the reservation row, then load it. Must be called inside a transaction. */
  async lockAndLoad(id: string): Promise<ReservationRecord> {
    if (!(await this.repo.lock(id))) {
      throw NotFound("reservation.not_found", "Reservation not found.");
    }
    return (await this.repo.findById(id))!;
  }

  private async allocate(
    reservationId: string,
    roomTypeId: string,
    arrival: IsoDate,
    departure: IsoDate,
    preferredRoomId: string | null,
  ): Promise<void> {
    if (preferredRoomId) {
      const room = await this.rooms.findById(preferredRoomId);
      if (!room || room.archivedAt || room.roomTypeId !== roomTypeId) {
        throw ValidationError("reservation.unknown_room", "Choose a room of the booked room type.");
      }
      if (room.serviceStatus === "out_of_service") {
        throw Conflict("reservation.room_out_of_service", `Room ${room.number} is out of service.`);
      }
      try {
        await withSavepoint(() => this.repo.allocate(room.id, reservationId, arrival, departure));
        return;
      } catch (err) {
        if (isExclusionViolation(err)) {
          throw Conflict(
            "reservation.room_unavailable",
            `Room ${room.number} is already booked for some of these nights.`,
          );
        }
        throw err;
      }
    }

    await this.claimAnyRoom(
      () => this.repo.candidateRooms(roomTypeId, arrival, departure),
      (roomId) => this.repo.allocate(roomId, reservationId, arrival, departure),
      "No room of this type is free for all of these nights.",
    );
  }

  private reallocateToAnyRoom(
    reservationId: string,
    roomTypeId: string,
    arrival: IsoDate,
    departure: IsoDate,
  ): Promise<string> {
    return this.claimAnyRoom(
      () => this.repo.candidateRooms(roomTypeId, arrival, departure, reservationId),
      (roomId) => this.repo.reallocate(reservationId, { roomId, arrival, departure }),
      "No room of this type is free for all of the new dates.",
    );
  }

  /**
   * Claim the first free candidate room. A lost race (23P01 from the exclusion constraint) rolls
   * back only that attempt's savepoint and moves on; candidates are re-read each round.
   */
  private async claimAnyRoom(
    candidates: () => Promise<Array<{ id: string }>>,
    claim: (roomId: string) => Promise<void>,
    soldOutMessage: string,
  ): Promise<string> {
    const tried = new Set<string>();
    for (let round = 0; round < MAX_ALLOCATION_ROUNDS; round++) {
      const fresh = (await candidates()).filter((c) => !tried.has(c.id));
      if (fresh.length === 0) break;
      for (const room of fresh) {
        tried.add(room.id);
        try {
          await withSavepoint(() => claim(room.id));
          return room.id;
        } catch (err) {
          if (!isExclusionViolation(err)) throw err;
        }
      }
    }
    throw Conflict("reservation.no_availability", soldOutMessage);
  }

  private validateStay(arrival: IsoDate, departure: IsoDate, today: IsoDate): void {
    const nights = daysBetween(arrival, departure);
    if (nights < 1) {
      throw ValidationError("reservation.invalid_dates", "Departure must be after arrival.");
    }
    if (nights > MAX_NIGHTS) {
      throw ValidationError(
        "reservation.stay_too_long",
        `A single reservation can cover at most ${MAX_NIGHTS} nights.`,
      );
    }
    if (arrival < today) {
      throw ValidationError("reservation.arrival_in_past", "Arrival can't be in the past.");
    }
  }

  private requireModifiable(r: ReservationRecord): void {
    if (!MODIFIABLE.has(r.status)) {
      throw Conflict(
        "reservation.not_modifiable",
        `A ${r.status.replace("_", " ")} reservation can't be changed.`,
      );
    }
  }

  private payload(r: ReservationRecord, actorId: string | null): ReservationEventPayload {
    return {
      reservationId: r.id,
      code: r.code,
      guestId: r.guestId,
      arrival: r.arrival,
      departure: r.departure,
      actorId,
    };
  }
}

const PAST: Record<ReservationCommand, string> = {
  confirm: "confirmed",
  check_in: "checked_in",
  check_out: "checked_out",
  cancel: "cancelled",
  no_show: "no_show",
};
