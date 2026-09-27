import { Injectable } from "@nestjs/common";
import { currentExecutor, readInTenant, unitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import type { Clock } from "@core/kernel/clock.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { PricingService } from "@hotel/hotel/pricing/application/pricing-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import { addDays } from "@hotel/hotel/shared/dates.js";
import {
  DEMO_DISCOUNTS,
  DEMO_GUESTS,
  DEMO_RATE_RULES,
  DEMO_RESERVATIONS,
  DEMO_ORG,
  DEMO_PASSWORD,
  DEMO_ROOMS,
  DEMO_ROOM_TYPES,
  DEMO_SETTINGS,
  DEMO_STAFF,
} from "./demo-data.js";

const log = moduleLogger("hotel-demo-seed");

/**
 * Opt-in demo dataset (`HOTEL_SEED_DEMO=true`, run from `AppSeedService` only). Idempotent: skips
 * entirely if the demo organization already exists. Mirrors
 * `atlas/backend/app/realestate/demo/demo-seeder.ts`: staff accounts are inserted directly with a
 * pre-verified email (the demo must be one click from signed-in) and get their roles through Core
 * RBAC; everything hotel-specific is created through the hotel domain services, acting as the
 * owner, so every invariant and audit entry is real.
 */
@Injectable()
export class DemoSeeder {
  constructor(
    private readonly rbac: RbacService,
    private readonly settings: SettingsService,
    private readonly roomTypes: RoomTypesService,
    private readonly rooms: RoomsService,
    private readonly guests: GuestsService,
    private readonly pricing: PricingService,
    private readonly reservations: ReservationsService,
  ) {}

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() =>
      currentExecutor()
        .selectFrom("organizations")
        .select("id")
        .where("slug", "=", DEMO_ORG.slug)
        .executeTakeFirst(),
    );
    if (already) {
      log.info("demo hotel already present — skipping");
      return;
    }

    const now = clock.now();
    const orgId = newId("org");
    const userIds = new Map<string, string>();
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const s of DEMO_STAFF) {
          const id = newId("usr");
          userIds.set(s.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: s.email,
              email_normalized: s.email.toLowerCase(),
              password_hash: passwordHash,
              display_name: s.name,
              status: "active",
              email_verified_at: now,
              locale: "en",
            })
            .execute();
        }
        await ex
          .insertInto("organizations")
          .values({ id: orgId, name: DEMO_ORG.name, slug: DEMO_ORG.slug, settings: {} })
          .execute();
        for (const s of DEMO_STAFF) {
          await ex
            .insertInto("organization_members")
            .values({
              id: newId("mem"),
              organization_id: orgId,
              user_id: userIds.get(s.key)!,
              membership_role: s.membershipRole,
            })
            .execute();
        }
      }),
    );

    const ownerId = userIds.get(DEMO_STAFF[0]!.key)!;
    for (const s of DEMO_STAFF) {
      await runAsSystem(() => this.rbac.assignRole(userIds.get(s.key)!, s.roleKey, ownerId, orgId));
    }

    await withContext({ userId: ownerId, organizationId: orgId }, async () => {
      await this.settings.update(DEMO_SETTINGS, ownerId);

      const typeIds = new Map<string, string>();
      for (const [i, t] of DEMO_ROOM_TYPES.entries()) {
        const created = await this.roomTypes.create({ ...t, sortOrder: i }, ownerId);
        typeIds.set(t.code, created.id);
      }
      const roomIds = new Map<string, string>();
      for (const [number, floor, code] of DEMO_ROOMS) {
        const room = await this.rooms.create(
          { number, floor, roomTypeId: typeIds.get(code)! },
          ownerId,
        );
        roomIds.set(number, room.id);
      }

      const guestIds = new Map<string, string>();
      for (const g of DEMO_GUESTS) {
        const { key, notes, ...input } = g;
        const created = await this.guests.create(input, ownerId);
        guestIds.set(key, created.id);
        for (const note of notes ?? []) {
          await this.guests.addNote(created.id, note, ownerId);
        }
      }

      for (const { roomTypeCode, ...rule } of DEMO_RATE_RULES) {
        await this.pricing.createRule(
          { ...rule, roomTypeId: roomTypeCode ? typeIds.get(roomTypeCode)! : null },
          ownerId,
        );
      }
      for (const d of DEMO_DISCOUNTS) {
        await this.pricing.createDiscount({ ...d, validFrom: null, validTo: null }, ownerId);
      }

      // Upcoming business relative to the hotel's today, booked through the real engine.
      const today = await readInTenant(() => this.settings.today());
      for (const r of DEMO_RESERVATIONS) {
        const arrival = addDays(today, r.arriveIn);
        const created = await this.reservations.create(
          {
            guestId: guestIds.get(r.guestKey)!,
            roomTypeId: typeIds.get(r.roomTypeCode)!,
            roomId: r.room ? roomIds.get(r.room)! : null,
            arrival,
            departure: addDays(arrival, r.nights),
            adults: r.adults,
            children: r.children ?? 0,
            source: r.source,
            notes: r.notes ?? null,
            discountCode: r.discountCode ?? null,
            confirm: r.confirm,
          },
          ownerId,
        );
        if (r.cancel) await this.reservations.cancel(created.id, r.cancel, ownerId);
      }
    });

    log.info(
      {
        org: DEMO_ORG.slug,
        staff: DEMO_STAFF.length,
        rooms: DEMO_ROOMS.length,
        guests: DEMO_GUESTS.length,
        reservations: DEMO_RESERVATIONS.length,
      },
      "demo hotel seeded",
    );
  }
}
