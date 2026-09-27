import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError, ValidationError } from "@core/kernel/errors.js";
import { addDays, daysBetween, eachNight, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { RoomTypesRepository } from "@hotel/hotel/rooms/infrastructure/room-types-repository.js";
import { RoomsRepository } from "@hotel/hotel/rooms/infrastructure/rooms-repository.js";
import { PricingService } from "@hotel/hotel/pricing/application/pricing-service.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { MAX_NIGHTS } from "./reservations-service.js";
import { ReservationsRepository } from "../infrastructure/reservations-repository.js";

export const MAX_CALENDAR_DAYS = 31;

/**
 * Read models over the allocation ledger: "what can we sell for these dates, at what price" and
 * the booking calendar. Both are ADVISORY — a room shown free can be taken a moment later; only
 * the allocation insert (exclusion constraint) decides.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly repo: ReservationsRepository,
    private readonly roomTypes: RoomTypesRepository,
    private readonly rooms: RoomsRepository,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
  ) {}

  search(input: {
    arrival: IsoDate;
    departure: IsoDate;
    adults: number;
    children: number;
    discountCode?: string | null;
  }) {
    return readInTenant(async () => {
      const nights = daysBetween(input.arrival, input.departure);
      if (nights < 1 || nights > MAX_NIGHTS) {
        throw ValidationError(
          "availability.invalid_dates",
          `Choose between 1 and ${MAX_NIGHTS} nights.`,
        );
      }
      const [types, free] = await Promise.all([
        this.roomTypes.list(false),
        this.repo.availabilityByType(input.arrival, input.departure),
      ]);
      const guests = input.adults + input.children;
      const results = [];
      for (const t of types) {
        const availableRooms = free.get(t.id) ?? 0;
        let quote = null;
        let unavailableReason: string | null = null;
        if (guests > t.capacity) unavailableReason = `Sleeps at most ${t.capacity}.`;
        else if (availableRooms === 0) unavailableReason = "Sold out for these dates.";
        try {
          quote = await this.pricing.quote({
            roomTypeId: t.id,
            arrival: input.arrival,
            departure: input.departure,
            discountCode: input.discountCode,
          });
        } catch (err) {
          if (!(err instanceof AppError)) throw err;
          unavailableReason ??= err.message;
        }
        results.push({
          roomType: {
            id: t.id,
            code: t.code,
            name: t.name,
            capacity: t.capacity,
            beds: t.beds,
            baseRate: t.baseRate,
            amenities: t.amenities,
          },
          availableRooms,
          bookable: unavailableReason === null,
          unavailableReason,
          quote,
        });
      }
      return { arrival: input.arrival, departure: input.departure, nights, results };
    });
  }

  /** Free rooms of a type for a stay (the room picker in the new-reservation flow). */
  freeRooms(roomTypeId: string, arrival: IsoDate, departure: IsoDate) {
    return readInTenant(() => this.repo.candidateRooms(roomTypeId, arrival, departure));
  }

  /** Rooms × days, with every active claim (reservation or block) overlapping the window. */
  calendar(from: IsoDate | undefined, days: number) {
    return readInTenant(async () => {
      const start = from ?? (await this.settings.today());
      const end = addDays(start, days);
      const [rooms, allocations] = await Promise.all([
        this.rooms.list({}),
        this.repo.allocationsBetween(start, end),
      ]);
      const byRoom = new Map<string, typeof allocations>();
      for (const a of allocations) {
        const list = byRoom.get(a.room_id) ?? [];
        list.push(a);
        byRoom.set(a.room_id, list);
      }
      return {
        from: start,
        to: end,
        days: eachNight(start, end),
        rooms: rooms.map((r) => ({
          id: r.id,
          number: r.number,
          floor: r.floor,
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomTypeName,
          roomTypeCode: r.roomTypeCode,
          serviceStatus: r.serviceStatus,
          bars: (byRoom.get(r.id) ?? []).map((a) => ({
            kind: a.kind,
            start: a.start,
            end: a.end,
            reservationId: a.reservation_id,
            code: a.code,
            status: a.status,
            guestName: a.guest_name,
            reason: a.reason,
          })),
        })),
      };
    });
  }
}
