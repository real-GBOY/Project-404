/**
 * Slice 7 — the workspace around the operations: scheduled jobs (auto no-show, hold expiry) as
 * the SYSTEM actor, staff notifications through Core, the ⌘K search, the readable audit feed,
 * and guest documents linked to files held by Core.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { currentExecutor } from "@core/kernel/db/db.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { NotificationService } from "@core/notifications/application/notification-service.js";
import { runAsOf } from "@hotel/hotel/shared/business-date.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { GuestDocumentsService } from "@hotel/hotel/guests/application/guest-documents-service.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import { HousekeepingService } from "@hotel/hotel/housekeeping/application/housekeeping-service.js";
import { MaintenanceService } from "@hotel/hotel/maintenance/application/maintenance-service.js";
import { JobsRunner } from "@hotel/hotel/jobs/application/jobs-runner.js";
import { ActivityService } from "@hotel/hotel/activity/application/activity-service.js";
import {
  asUser,
  createHotelHttpTestApp,
  get,
  hasTestDb,
  loginAs,
  seedHotel,
  seedStaff,
  type SeededHotel,
} from "./helpers.js";

const clock = fixedClock("2026-10-01T08:00:00.000Z");
const TODAY = "2026-10-01";

describe.skipIf(!hasTestDb)("HotelOS workspace (Slice 7)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;

  interface Hotel {
    hotel: SeededHotel;
    typeId: string;
    roomIds: string[];
    guestId: string;
    as: <T>(date: string, fn: () => Promise<T>) => Promise<T>;
  }

  async function setupHotel(name: string, rooms = 3): Promise<Hotel> {
    const hotel = await seedHotel(app, name);
    const as = <T>(date: string, fn: () => Promise<T>) =>
      runAsOf(date, () => asUser(hotel.ownerId, hotel.orgId, fn));
    const ids = await as("2026-09-20", async () => {
      const type = await get<RoomTypesService>(app, RoomTypesService).create(
        {
          code: "DLX",
          name: "Grand Deluxe Room",
          capacity: 2,
          beds: "1 King bed",
          baseRate: 5000,
          amenities: [],
          sortOrder: 0,
        },
        hotel.ownerId,
      );
      const roomIds: string[] = [];
      for (let i = 1; i <= rooms; i++) {
        roomIds.push(
          (
            await get<RoomsService>(app, RoomsService).create(
              { number: `60${i}`, floor: 6, roomTypeId: type.id },
              hotel.ownerId,
            )
          ).id,
        );
      }
      const guest = await get<GuestsService>(app, GuestsService).create(
        {
          fullName: "Yasmin Ibrahim",
          phone: "+20 109 555 0101",
          email: "yasmin@example.com",
          nationality: "EG",
          idDocumentType: null,
          idDocumentNumber: null,
          preferences: null,
          vip: false,
        },
        hotel.ownerId,
      );
      return { typeId: type.id, roomIds, guestId: guest.id };
    });
    return { hotel, ...ids, as };
  }

  const book = (h: Hotel, on: string, arrival: string, departure: string, confirm = true) =>
    h.as(on, () =>
      get<ReservationsService>(app, ReservationsService).create(
        {
          guestId: h.guestId,
          roomTypeId: h.typeId,
          arrival,
          departure,
          adults: 2,
          children: 0,
          source: "phone",
          confirm,
        },
        h.hotel.ownerId,
      ),
    );

  /** A user's hotel notifications (Core also sends everyone a welcome note). */
  const inbox = async (h: Hotel, userId: string) =>
    (
      await asUser(userId, h.hotel.orgId, () =>
        get<NotificationService>(app, NotificationService).listForUser(userId, {}),
      )
    ).filter((n) => n.type.startsWith("hotel."));

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("scheduled jobs", () => {
    it("marks overdue arrivals no-show and releases stale holds — as the system, once", async () => {
      const h = await setupHotel("Jobs Hotel");
      const reservations = get<ReservationsService>(app, ReservationsService);
      const overdue = await book(h, "2026-09-25", "2026-09-29", "2026-09-30");
      const dueToday = await book(h, "2026-09-25", TODAY, "2026-10-02");
      const pastHold = await book(h, "2026-09-25", "2026-09-30", "2026-10-01", false);
      const staleHold = await book(h, TODAY, "2026-10-10", "2026-10-11", false);
      const freshHold = await book(h, TODAY, "2026-10-12", "2026-10-13", false);
      // A hold made three days ago (created_at is the moment it was taken).
      await asUser(h.hotel.ownerId, h.hotel.orgId, () =>
        sql`UPDATE hotel_reservations SET created_at = ${new Date("2026-09-28T08:00:00Z")}
             WHERE id = ${staleHold.id}`.execute(currentExecutor()),
      );
      const desk = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");

      const runner = get<JobsRunner>(app, JobsRunner);
      await runAsOf(TODAY, () => runner.tick());
      const status = (id: string) => h.as(TODAY, () => reservations.get(id));

      const noShow = await status(overdue.id);
      expect(noShow.status).toBe("no_show");
      expect(noShow.history.at(-1)).toMatchObject({ toStatus: "no_show", actorName: "System" });
      expect((await status(dueToday.id)).status).toBe("confirmed");
      expect((await status(pastHold.id)).status).toBe("cancelled");
      expect((await status(staleHold.id)).status).toBe("cancelled");
      expect((await status(staleHold.id)).cancellationReason).toBe(
        "Hold expired — never confirmed",
      );
      expect((await status(freshHold.id)).status).toBe("pending");

      // The front desk hears about what the system did; running again changes nothing.
      const notes = await inbox(h, desk.userId);
      expect(notes.map((n) => n.title).sort()).toEqual(
        [
          `#${overdue.code} marked as a no-show`,
          `#${pastHold.code} released — hold expired`,
          `#${staleHold.code} released — hold expired`,
        ].sort(),
      );
      const again = await runAsOf(TODAY, () => runner.tick());
      expect(again).toBeDefined();
      expect((await inbox(h, desk.userId)).length).toBe(3);
    });
  });

  describe("notifications", () => {
    it("tells the assignee, and asks supervisors to verify — never the person who acted", async () => {
      const h = await setupHotel("Notify Hotel");
      const maid = await seedStaff(app, h.hotel, "housekeeping", "Hassan Ali");
      const tech = await seedStaff(app, h.hotel, "maintenance", "Omar Tarek");
      const manager = await seedStaff(app, h.hotel, "manager", "Mona Farid");
      const hk = get<HousekeepingService>(app, HousekeepingService);
      const mt = get<MaintenanceService>(app, MaintenanceService);

      const task = await h.as(TODAY, () =>
        hk.create(
          { roomId: h.roomIds[0]!, kind: "deep_clean", priority: "normal", notes: null },
          h.hotel.ownerId,
        ),
      );
      await h.as(TODAY, () => hk.assign(task.id, maid.userId, h.hotel.ownerId));
      const [maidNote] = await inbox(h, maid.userId);
      expect(maidNote).toMatchObject({
        title: "Room 601 is yours to clean",
        body: expect.stringContaining("Deep clean"),
        data: expect.objectContaining({ href: "/housekeeping" }),
      });

      // An urgent report reaches the supervisors (owner + manager), not the reporter (owner).
      const ticket = await h.as(TODAY, () =>
        mt.report(
          {
            roomId: h.roomIds[1]!,
            title: "Water leaking from ceiling",
            description: null,
            priority: "urgent",
            roomImpact: "none",
            expectedBack: null,
          },
          h.hotel.ownerId,
        ),
      );
      expect((await inbox(h, manager.userId)).map((n) => n.title)).toContain(
        `${ticket.number} reported — Room 602`,
      );
      expect(await inbox(h, h.hotel.ownerId)).toEqual([]);

      await h.as(TODAY, () => mt.assign(ticket.id, tech.userId, manager.userId));
      expect((await inbox(h, tech.userId))[0]!.title).toBe(`${ticket.number} assigned to you`);

      await runAsOf(TODAY, () =>
        asUser(tech.userId, h.hotel.orgId, () => mt.start(ticket.id, tech.userId)),
      );
      await runAsOf(TODAY, () =>
        asUser(tech.userId, h.hotel.orgId, () => mt.resolve(ticket.id, "Resealed", tech.userId)),
      );
      const toVerify = (await inbox(h, manager.userId)).find((n) =>
        n.title.includes("ready to verify"),
      );
      expect(toVerify?.body).toBe("Room 602: Water leaking from ceiling — resolved by Omar Tarek.");
    });
  });

  it("searches only what the caller may read", async () => {
    const h = await setupHotel("Search Hotel");
    const r = await book(h, TODAY, "2026-10-03", "2026-10-05");
    const receptionist = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");
    const maid = await seedStaff(app, h.hotel, "housekeeping", "Hassan Ali");
    const search = async (token: string, q: string) =>
      (
        await http.inject({
          method: "GET",
          url: `/api/hotel/search?q=${encodeURIComponent(q)}`,
          headers: { authorization: `Bearer ${token}` },
        })
      ).json() as { groups: Array<{ key: string; items: Array<{ title: string; href: string }> }> };

    const rt = await loginAs(http, receptionist.email);
    const byName = await search(rt, "yasmin");
    expect(byName.groups.map((g) => g.key)).toEqual(["guests", "reservations"]);
    expect(byName.groups[1]!.items[0]).toMatchObject({
      title: `#${r.code} · Yasmin Ibrahim`,
      href: `/reservations/${r.id}`,
    });
    expect((await search(rt, r.code)).groups[0]!.key).toBe("reservations");

    // Housekeeping reads rooms and bookings, but not guest profiles or invoices.
    const mt = await loginAs(http, maid.email);
    expect((await search(mt, "60")).groups.map((g) => g.key)).toEqual(["rooms"]);
    expect((await search(mt, "yasmin")).groups.map((g) => g.key)).toEqual(["reservations"]);
  });

  it("turns the audit trail into readable activity, with who, what and a link", async () => {
    const h = await setupHotel("Activity Hotel");
    const r = await book(h, TODAY, "2026-10-03", "2026-10-05");
    await h.as(TODAY, () =>
      get<ReservationsService>(app, ReservationsService).cancel(
        r.id,
        "Plans changed",
        h.hotel.ownerId,
      ),
    );
    const feed = await asUser(h.hotel.ownerId, h.hotel.orgId, () =>
      get<ActivityService>(app, ActivityService).list({ limit: 50 }),
    );
    const cancelled = feed.items.find((i) => i.action === "hotel.reservation.cancelled")!;
    expect(cancelled).toMatchObject({
      actorName: "Hotel Owner",
      verb: "cancelled reservation",
      subject: `#${r.code}`,
      href: `/reservations/${r.id}`,
      detail: "Plans changed",
      severity: "warning",
    });
    const created = feed.items.find((i) => i.action === "hotel.guest.created")!;
    expect(created).toMatchObject({ verb: "registered guest", subject: "Yasmin Ibrahim" });
  });

  it("links a guest's ID scan — only a finished upload, and only your own", async () => {
    const h = await setupHotel("Documents Hotel");
    const storage = get<IFileStorage>(app, FILE_STORAGE);
    const docs = get<GuestDocumentsService>(app, GuestDocumentsService);
    const receptionist = await seedStaff(app, h.hotel, "receptionist", "Rania Kamal");
    const asDesk = <T>(fn: () => Promise<T>) => asUser(receptionist.userId, h.hotel.orgId, fn);

    const scan = await asDesk(() =>
      storage.upload({
        content: Buffer.from("%PDF-1.4 passport scan"),
        originalName: "passport.pdf",
        contentType: "application/pdf",
        ownerId: receptionist.userId,
      }),
    );
    // The owner didn't upload it, so can't attach it.
    await expect(
      h.as(TODAY, () =>
        docs.attach(
          h.guestId,
          { fileId: scan.id, kind: "id_document", label: null },
          h.hotel.ownerId,
        ),
      ),
    ).rejects.toMatchObject({ code: "document.not_yours" });

    const { id } = await asDesk(() =>
      docs.attach(
        h.guestId,
        { fileId: scan.id, kind: "id_document", label: "Passport" },
        receptionist.userId,
      ),
    );
    await expect(
      asDesk(() =>
        docs.attach(
          h.guestId,
          { fileId: scan.id, kind: "other", label: null },
          receptionist.userId,
        ),
      ),
    ).rejects.toMatchObject({ code: "document.already_attached" });
    expect(await asDesk(() => docs.list(h.guestId))).toEqual([
      expect.objectContaining({
        id,
        kind: "id_document",
        label: "Passport",
        fileName: "passport.pdf",
        contentType: "application/pdf",
        uploadedByName: "Rania Kamal",
      }),
    ]);

    await asDesk(() => docs.remove(h.guestId, id, receptionist.userId));
    expect(await asDesk(() => docs.list(h.guestId))).toEqual([]);
  });
});
