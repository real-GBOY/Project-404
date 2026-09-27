import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { addDays, daysBetween, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { isExclusionViolation } from "@hotel/hotel/shared/pg-errors.js";
import { withSavepoint } from "@hotel/hotel/shared/savepoint.js";
import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomsRepository } from "@hotel/hotel/rooms/infrastructure/rooms-repository.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import {
  ReservationsRepository,
  type ReservationRecord,
} from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { PricingService } from "@hotel/hotel/pricing/application/pricing-service.js";
import { BillingService } from "@hotel/hotel/billing/application/billing-service.js";
import { BillingRepository } from "@hotel/hotel/billing/infrastructure/billing-repository.js";
import { paymentStatusFor, taxFor } from "@hotel/hotel/billing/domain/folio.js";
import type { PaymentMethod } from "@hotel/hotel/billing/domain/payment-provider.js";
import { HousekeepingService } from "@hotel/hotel/housekeeping/application/housekeeping-service.js";
import { transition } from "@hotel/hotel/reservations/domain/reservation-state.js";

const READY: ReadonlySet<string> = new Set(["clean", "inspected"]);

/**
 * Check-in and check-out are WORKFLOWS, not buttons: each is one transaction that moves the
 * reservation, the folio, the room and housekeeping together — or none of them.
 */
@Injectable()
export class FrontDeskService {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly reservationsRepo: ReservationsRepository,
    private readonly rooms: RoomsRepository,
    private readonly billing: BillingService,
    private readonly billingRepo: BillingRepository,
    private readonly pricing: PricingService,
    private readonly housekeeping: HousekeepingService,
    private readonly settings: SettingsService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** The desk's day: arrivals to check in, departures due, and who is in house. */
  today() {
    return readInTenant(async () => {
      const today = await this.settings.today();
      const { taxRate } = await this.settings.current();
      const lists = await this.reservationsRepo.frontDesk(today);
      const all = [...lists.arrivals, ...lists.inHouse];
      const [aggregates, rooms] = await Promise.all([
        this.billingRepo.aggregates(all.map((r) => r.id)),
        this.rooms.list({}),
      ]);
      const roomById = new Map(rooms.map((r) => [r.id, r]));
      const decorate = (r: ReservationRecord) => {
        const a = aggregates.get(r.id);
        const posted = (a?.chargeCount ?? 0) > 0;
        const totalP = posted
          ? toPiastres(a!.charges) + toPiastres(a!.tax)
          : toPiastres(r.total) + toPiastres(taxFor(r.total, taxRate));
        const paidP = toPiastres(a?.paid ?? 0);
        const room = r.roomId ? roomById.get(r.roomId) : undefined;
        return {
          ...r,
          folio: {
            total: fromPiastres(totalP),
            paid: fromPiastres(paidP),
            balance: fromPiastres(totalP - paidP),
            paymentStatus: paymentStatusFor(fromPiastres(totalP), fromPiastres(paidP), 0),
          },
          room: room
            ? {
                housekeepingStatus: room.housekeepingStatus,
                serviceStatus: room.serviceStatus,
                ready: READY.has(room.housekeepingStatus) && room.serviceStatus === "in_service",
              }
            : null,
        };
      };
      return {
        date: today,
        arrivals: lists.arrivals.map(decorate),
        departures: lists.departures.map(decorate),
        inHouse: lists.inHouse.map(decorate),
      };
    });
  }

  /**
   * Check a confirmed guest in: arrival has come, the stay hasn't ended, the room is in service,
   * clean and nobody is in it. Posts every booked night to the folio, then transitions.
   */
  checkIn(reservationId: string, input: { roomId?: string | null }, actorId: string) {
    return this.uow.transaction(async () => {
      let r = await this.reservations.lockAndLoad(reservationId);
      transition(r.status, "check_in"); // canonical error for anything but a confirmed booking
      if (input.roomId && input.roomId !== r.roomId) {
        r = await this.reservations.changeRoom(reservationId, input.roomId, actorId);
      }
      const today = await this.settings.today();
      if (r.status === "confirmed" && r.arrival > today) {
        throw Conflict("checkin.too_early", `This stay starts on ${r.arrival}.`);
      }
      if (r.status === "confirmed" && r.departure <= today) {
        throw Conflict("checkin.stay_over", "This stay has already ended — rebook the guest.");
      }
      const room = await this.requireRoom(r);
      await this.rooms.lock(room.id);
      if (room.serviceStatus !== "in_service") {
        throw Conflict(
          "checkin.room_out_of_service",
          `Room ${room.number} is not in service. Choose another room.`,
        );
      }
      if (!READY.has(room.housekeepingStatus)) {
        throw Conflict(
          "checkin.room_not_ready",
          `Room ${room.number} is ${room.housekeepingStatus} — choose a ready room or wait for housekeeping.`,
          { housekeepingStatus: room.housekeepingStatus },
        );
      }
      const occupancy = await this.rooms.occupancy(today);
      if (occupancy.get(room.id)?.occupied) {
        throw Conflict(
          "checkin.room_occupied",
          `Room ${room.number} still has a guest checked in.`,
        );
      }
      // State machine first (it rejects anything but confirmed), then post the nights.
      const checkedIn = await this.reservations.applyTransition(r, "check_in", actorId);
      await this.billing.postRoomCharges(checkedIn, actorId);
      return checkedIn;
    });
  }

  /**
   * Check a guest out — one transaction: release unused nights (early departure), require a
   * settled folio, issue the invoice, transition, mark the room dirty, open the cleaning task
   * (high priority if someone arrives into this room today). An optional payment is taken first
   * through the normal provider flow, so the folio can be settled in the same action.
   */
  async checkOut(
    reservationId: string,
    input: { payment?: { method: PaymentMethod; amount: number; idempotencyKey: string } | null },
    actorId: string,
  ) {
    if (input.payment) {
      await this.billing.collectPayment(reservationId, input.payment, actorId);
    }
    return this.uow.transaction(async () => {
      const r = await this.reservations.lockAndLoad(reservationId);
      if (r.status !== "checked_in") {
        // Let the state machine produce the canonical error.
        await this.reservations.applyTransition(r, "check_out", actorId);
      }
      const today = await this.settings.today();
      if (today > r.departure) {
        throw Conflict(
          "checkout.overstay",
          `The stay ended on ${r.departure}. Extend it to today before checking out.`,
        );
      }
      if (today < r.departure) {
        // Early departure: keep at least one night, release the rest.
        const lastNightEnd = today > r.arrival ? today : addDays(r.arrival, 1);
        await this.billing.voidUnusedNights(r.id, lastNightEnd, this.clock.now());
        await this.reservationsRepo.shrinkStay(r.id, lastNightEnd);
      }
      const totals = await this.billing.totals(r);
      if (totals.balance > 0) {
        throw Conflict(
          "checkout.balance_due",
          `${totals.balance.toFixed(2)} EGP is still outstanding. Take payment before checking out.`,
          { balance: totals.balance },
        );
      }
      if (totals.balance < 0) {
        throw Conflict(
          "checkout.refund_due",
          `The guest has overpaid by ${(-totals.balance).toFixed(2)} EGP. Refund it before checking out.`,
          { balance: totals.balance },
        );
      }
      const invoiceId = await this.billing.issueInvoice(r, actorId);
      const checkedOut = await this.reservations.applyTransition(r, "check_out", actorId, null, {
        invoiceId,
      });
      const room = await this.requireRoom(r);
      await this.rooms.setHousekeepingStatus(room.id, "dirty");
      const arrivingToday =
        (await this.rooms.occupancy(today)).get(room.id)?.arrivingToday ?? false;
      const taskId = await this.housekeeping.openForRoom({
        roomId: room.id,
        reservationId: r.id,
        kind: "checkout_clean",
        priority: arrivingToday ? "high" : "normal",
        notes: arrivingToday ? "Arrival due today — turn this room first." : null,
        actorId,
      });
      return { reservation: checkedOut, invoiceId, housekeepingTaskId: taskId };
    });
  }

  /**
   * Extend an in-house stay: claim the extra nights on the same room (the exclusion constraint
   * decides), price them server-side, post them to the folio.
   */
  extendStay(reservationId: string, newDeparture: IsoDate, actorId: string) {
    return this.uow.transaction(async () => {
      const r = await this.reservations.lockAndLoad(reservationId);
      if (r.status !== "checked_in") {
        throw Conflict("extend.not_in_house", "Only an in-house stay can be extended.");
      }
      if (newDeparture <= r.departure) {
        throw ValidationError("extend.not_later", "Choose a departure after the current one.");
      }
      if (daysBetween(r.arrival, newDeparture) > 60) {
        throw ValidationError("extend.too_long", "A stay can't exceed 60 nights.");
      }
      const room = await this.requireRoom(r);
      try {
        await withSavepoint(() =>
          this.reservationsRepo.reallocate(r.id, {
            roomId: room.id,
            arrival: r.arrival,
            departure: newDeparture,
          }),
        );
      } catch (err) {
        if (isExclusionViolation(err)) {
          throw Conflict(
            "extend.room_booked",
            `Room ${room.number} is booked by another guest within these dates. Move the guest to another room first.`,
          );
        }
        throw err;
      }
      const extra = await this.pricing.quote({
        roomTypeId: r.roomTypeId,
        arrival: r.departure,
        departure: newDeparture,
        discountCode: r.discountCode,
      });
      await this.reservationsRepo.updateStayAndPrice(r.id, {
        arrival: r.arrival,
        departure: newDeparture,
        nightlyRates: [...r.nightlyRates, ...extra.nights],
        roomTotal: fromPiastres(toPiastres(r.roomTotal) + toPiastres(extra.roomTotal)),
        discountAmount: fromPiastres(
          toPiastres(r.discountAmount) + toPiastres(extra.discountAmount),
        ),
        total: fromPiastres(toPiastres(r.total) + toPiastres(extra.total)),
      });
      const extended = (await this.reservationsRepo.findById(r.id))!;
      await this.billing.postRoomCharges(
        { ...extended, nightlyRates: extra.nights, roomTotal: extra.roomTotal, total: extra.total },
        actorId,
      );
      await this.audit.record({
        actorId,
        action: "hotel.reservation.extended",
        resourceType: "hotel_reservation",
        resourceId: r.id,
        before: { departure: r.departure, total: r.total },
        after: { departure: newDeparture, total: extended.total },
      });
      return extended;
    });
  }

  private async requireRoom(r: ReservationRecord) {
    const room = r.roomId ? await this.rooms.findById(r.roomId) : null;
    if (!room) throw Conflict("frontdesk.no_room", "This reservation has no room assigned.");
    return room;
  }
}
