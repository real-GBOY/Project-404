import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { getContext, runAsSystem, runWithContext } from "@core/kernel/logging/context.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { toPiastres, fromPiastres } from "@hotel/hotel/shared/money.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { GuestsRepository } from "@hotel/hotel/guests/infrastructure/guests-repository.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import { ReservationsRepository } from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { AvailabilityService } from "@hotel/hotel/reservations/application/availability-service.js";
import { taxFor } from "@hotel/hotel/billing/domain/folio.js";

export interface PublicBookingInput {
  roomTypeId: string;
  arrival: IsoDate;
  departure: IsoDate;
  adults: number;
  children: number;
  discountCode: string | null;
  notes: string | null;
  guest: { fullName: string; email: string; phone: string | null; nationality: string | null };
}

/** "Only 2 left" — never the exact inventory beyond a small number. */
const SCARCITY_THRESHOLD = 3;

/**
 * The hotel's public face: what the website may ask without signing in. A property is named by
 * its organization slug; every call then runs in that property's tenant context, so RLS applies
 * exactly as it does for staff. Bookings go through the same reservation engine as the front
 * desk — the database still decides whether the room is free — and a retried booking with the
 * same Idempotency-Key returns the original instead of booking twice.
 */
@Injectable()
export class PublicBookingService {
  constructor(
    private readonly settings: SettingsService,
    private readonly roomTypes: RoomTypesService,
    private readonly availability: AvailabilityService,
    private readonly reservations: ReservationsService,
    private readonly reservationsRepo: ReservationsRepository,
    private readonly guests: GuestsService,
    private readonly guestsRepo: GuestsRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /**
   * Run `fn` as the named property (404 for an unknown slug). The organization is looked up on
   * the system connection — an anonymous visitor isn't a member, so Core's RLS wouldn't show it —
   * and everything in `fn` then runs in that tenant's context, under RLS.
   */
  async asHotel<T>(
    slug: string,
    fn: (org: { id: string; name: string }) => Promise<T>,
  ): Promise<T> {
    const org = await runAsSystem(() =>
      this.uow.transaction(() =>
        currentExecutor()
          .selectFrom("organizations")
          .select(["id", "name"])
          .where("slug", "=", slug)
          .executeTakeFirst(),
      ),
    );
    if (!org) throw NotFound("hotel.not_found", "Hotel not found.");
    const correlationId = getContext()?.correlationId ?? `public-${slug}`;
    return runWithContext({ correlationId, organizationId: org.id }, () => fn(org));
  }

  hotel(slug: string) {
    return this.asHotel(slug, (org) =>
      readInTenant(async () => {
        const [s, name, types] = await Promise.all([
          this.settings.operating(),
          this.settings.savedName(),
          this.roomTypes.list(false),
        ]);
        return {
          name: name ?? org.name,
          currency: s.currency,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
          taxRate: s.taxRate,
          today: await this.settings.today(),
          roomTypes: types.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            capacity: t.capacity,
            beds: t.beds,
            fromRate: t.baseRate,
            amenities: t.amenities,
          })),
        };
      }),
    );
  }

  search(
    slug: string,
    q: {
      arrival: IsoDate;
      departure: IsoDate;
      adults: number;
      children: number;
      discountCode: string | null;
    },
  ) {
    return this.asHotel(slug, async () => {
      const [found, s] = await Promise.all([
        this.availability.search(q),
        readInTenant(() => this.settings.operating()),
      ]);
      return {
        arrival: found.arrival,
        departure: found.departure,
        nights: found.nights,
        currency: s.currency,
        results: found.results
          .filter((r) => r.bookable && r.quote)
          .map((r) => {
            const total = r.quote!.total;
            const tax = taxFor(total, s.taxRate);
            return {
              roomType: {
                id: r.roomType.id,
                name: r.roomType.name,
                capacity: r.roomType.capacity,
                beds: r.roomType.beds,
                amenities: r.roomType.amenities,
              },
              fewLeft: r.availableRooms <= SCARCITY_THRESHOLD ? r.availableRooms : null,
              nights: r.quote!.nights.map((n) => ({ date: n.date, rate: n.rate })),
              roomTotal: r.quote!.roomTotal,
              discountCode: r.quote!.discountCode,
              discountAmount: r.quote!.discountAmount,
              total,
              tax,
              grandTotal: fromPiastres(toPiastres(total) + toPiastres(tax)),
            };
          }),
      };
    });
  }

  book(slug: string, input: PublicBookingInput, idempotencyKey: string) {
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.asHotel(slug, async (org) => {
      try {
        const reservationId = await this.uow.transaction(async () => {
          const prior = await this.prior(idempotencyKey);
          if (prior) {
            if (prior.request_hash !== requestHash) {
              throw Conflict(
                "booking.idempotency_mismatch",
                "That idempotency key was already used for a different booking.",
              );
            }
            return prior.reservation_id;
          }
          const guest =
            (await this.guestsRepo.findByEmail(input.guest.email)) ??
            (await this.guests.create(
              {
                fullName: input.guest.fullName,
                email: input.guest.email,
                phone: input.guest.phone,
                nationality: input.guest.nationality,
                idDocumentType: null,
                idDocumentNumber: null,
                preferences: null,
                vip: false,
              },
              null,
            ));
          const r = await this.reservations.create(
            {
              guestId: guest.id,
              roomTypeId: input.roomTypeId,
              roomId: null,
              arrival: input.arrival,
              departure: input.departure,
              adults: input.adults,
              children: input.children,
              source: "website",
              notes: input.notes,
              discountCode: input.discountCode,
              confirm: true,
            },
            null,
          );
          await hotelDb()
            .insertInto("hotel_public_bookings")
            .values({
              organization_id: requireOrganizationId(),
              idempotency_key: idempotencyKey,
              request_hash: requestHash,
              reservation_id: r.id,
            })
            .execute();
          return r.id;
        });
        return this.confirmation(reservationId, org.name);
      } catch (err) {
        // A concurrent retry with the same key won — hand back its booking.
        if (isUniqueViolation(err, "hotel_public_bookings_pkey")) {
          const prior = await readInTenant(() => this.prior(idempotencyKey));
          if (prior && prior.request_hash === requestHash) {
            return this.confirmation(prior.reservation_id, org.name);
          }
        }
        throw err;
      }
    });
  }

  private prior(key: string) {
    return hotelDb()
      .selectFrom("hotel_public_bookings")
      .select(["reservation_id", "request_hash"])
      .where("idempotency_key", "=", key)
      .executeTakeFirst();
  }

  /** What the guest sees: their booking reference and price — no internal ids or room numbers. */
  private confirmation(reservationId: string, orgName: string) {
    return readInTenant(async () => {
      const [r, s, name] = await Promise.all([
        this.reservationsRepo.findById(reservationId),
        this.settings.operating(),
        this.settings.savedName(),
      ]);
      const tax = taxFor(r!.total, s.taxRate);
      return {
        code: r!.code,
        status: r!.status,
        guestName: r!.guestName,
        roomTypeName: r!.roomTypeName,
        arrival: r!.arrival,
        departure: r!.departure,
        nights: r!.nightlyRates.length,
        adults: r!.adults,
        children: r!.children,
        total: r!.total,
        tax,
        grandTotal: fromPiastres(toPiastres(r!.total) + toPiastres(tax)),
        currency: s.currency,
        checkInTime: s.checkInTime,
        checkOutTime: s.checkOutTime,
        hotelName: name ?? orgName,
      };
    });
  }
}
