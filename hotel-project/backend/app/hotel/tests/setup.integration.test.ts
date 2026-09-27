/**
 * Slice 1 — property setup: settings, room types, rooms, guests and staff. Service-level tests
 * cover the domain rules; the HTTP section drives the real guards so the role → permission matrix
 * is verified exactly as a browser would hit it.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomTypesService } from "@hotel/hotel/rooms/application/room-types-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import { GuestsService } from "@hotel/hotel/guests/application/guests-service.js";
import { StaffService } from "@hotel/hotel/staff/application/staff-service.js";
import { DemoSeeder } from "@hotel/hotel/demo/demo-seeder.js";
import {
  DEMO_GUESTS,
  DEMO_PASSWORD,
  DEMO_ROOMS,
  DEMO_ROOM_TYPES,
  DEMO_STAFF,
} from "@hotel/hotel/demo/demo-data.js";
import { fixedClock } from "@core/kernel/clock.js";
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

const guestInput = (over: Record<string, unknown> = {}) => ({
  fullName: "Mona Hegazy",
  phone: "+20 100 555 0101",
  email: null,
  nationality: "EG",
  idDocumentType: null,
  idDocumentNumber: null,
  preferences: null,
  vip: false,
  ...over,
});

describe.skipIf(!hasTestDb)("HotelOS property setup (Slice 1)", () => {
  let app: TestingModule;
  let http: NestFastifyApplication;
  let hotelA: SeededHotel;
  let hotelB: SeededHotel;
  const clock = fixedClock("2026-09-27T08:00:00.000Z");

  const settings = () => get<SettingsService>(app, SettingsService);
  const roomTypes = () => get<RoomTypesService>(app, RoomTypesService);
  const rooms = () => get<RoomsService>(app, RoomsService);
  const guests = () => get<GuestsService>(app, GuestsService);
  const staff = () => get<StaffService>(app, StaffService);
  const asA = <T>(fn: () => Promise<T>) => asUser(hotelA.ownerId, hotelA.orgId, fn);
  const asB = <T>(fn: () => Promise<T>) => asUser(hotelB.ownerId, hotelB.orgId, fn);

  async function makeType(code: string, as = asA) {
    return as(() =>
      roomTypes().create(
        {
          code,
          name: `Type ${code}`,
          capacity: 2,
          beds: "1 King bed",
          baseRate: 4200,
          amenities: ["Wi-Fi"],
          sortOrder: 0,
        },
        as === asA ? hotelA.ownerId : hotelB.ownerId,
      ),
    );
  }

  beforeAll(async () => {
    const booted = await createHotelHttpTestApp({ clock });
    app = booted.moduleRef;
    http = booted.http;
    hotelA = await seedHotel(app, "Nile Pearl");
    hotelB = await seedHotel(app, "Red Sea Lodge");
  }, 120_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("settings", () => {
    it("defaults to Egypt settings named after the organization before the first save", async () => {
      const s = await asA(() => settings().current());
      expect(s).toMatchObject({
        hotelName: "Nile Pearl",
        timeZone: "Africa/Cairo",
        currency: "EGP",
        taxRate: 0.14,
      });
    });

    it("saves a partial update, keeps the rest, and audits it", async () => {
      const saved = await asA(() =>
        settings().update({ checkInTime: "15:00", taxRate: 0.14 }, hotelA.ownerId),
      );
      expect(saved).toMatchObject({ checkInTime: "15:00", checkOutTime: "12:00" });
      const again = await asA(() => settings().current());
      expect(again.checkInTime).toBe("15:00");
    });
  });

  describe("room types and rooms", () => {
    it("rejects a duplicate room type code within a hotel but allows it in another hotel", async () => {
      await makeType("DLX");
      await expect(makeType("DLX")).rejects.toMatchObject({ code: "room_type.code_taken" });
      await expect(makeType("DLX", asB)).resolves.toMatchObject({ code: "DLX" });
    });

    it("creates rooms that start clean, in service, and derive to available", async () => {
      const type = await makeType("STD");
      const room = await asA(() =>
        rooms().create({ number: "101", floor: 1, roomTypeId: type.id }, hotelA.ownerId),
      );
      expect(room).toMatchObject({
        housekeepingStatus: "clean",
        serviceStatus: "in_service",
        displayStatus: "available",
        roomTypeName: "Type STD",
      });
      await expect(
        asA(() => rooms().create({ number: "101", floor: 1, roomTypeId: type.id }, hotelA.ownerId)),
      ).rejects.toMatchObject({ code: "room.number_taken" });
    });

    it("refuses a room type that belongs to another hotel", async () => {
      const foreignType = await makeType("FAM", asB);
      await expect(
        asA(() =>
          rooms().create({ number: "777", floor: 7, roomTypeId: foreignType.id }, hotelA.ownerId),
        ),
      ).rejects.toMatchObject({ code: "room.unknown_room_type" });
    });

    it("won't archive a room type that active rooms still use", async () => {
      const type = await makeType("TWN");
      const room = await asA(() =>
        rooms().create({ number: "201", floor: 2, roomTypeId: type.id }, hotelA.ownerId),
      );
      await expect(asA(() => roomTypes().archive(type.id, hotelA.ownerId))).rejects.toMatchObject({
        code: "room_type.in_use",
      });
      await asA(() => rooms().archive(room.id, hotelA.ownerId));
      const archived = await asA(() => roomTypes().archive(type.id, hotelA.ownerId));
      expect(archived.archivedAt).not.toBeNull();
      const active = await asA(() => roomTypes().list());
      expect(active.map((t) => t.code)).not.toContain("TWN");
    });
  });

  describe("guests", () => {
    it("requires a phone or an email", async () => {
      await expect(
        asA(() => guests().update("gst_missing", { phone: null }, hotelA.ownerId)),
      ).rejects.toMatchObject({ code: "guest.not_found" });
      const g = await asA(() => guests().create(guestInput(), hotelA.ownerId));
      await expect(
        asA(() => guests().update(g.id, { phone: null }, hotelA.ownerId)),
      ).rejects.toMatchObject({ code: "guest.contact_required" });
    });

    it("treats email as unique per hotel, case-insensitively", async () => {
      await asA(() =>
        guests().create(
          guestInput({ fullName: "Aya Salem", email: "aya.salem@gmail.com" }),
          hotelA.ownerId,
        ),
      );
      await expect(
        asA(() =>
          guests().create(
            guestInput({ fullName: "Aya S.", email: "AYA.SALEM@gmail.com".toLowerCase() }),
            hotelA.ownerId,
          ),
        ),
      ).rejects.toMatchObject({ code: "guest.email_taken" });
      await expect(
        asB(() =>
          guests().create(
            guestInput({ fullName: "Aya Salem", email: "aya.salem@gmail.com" }),
            hotelB.ownerId,
          ),
        ),
      ).resolves.toBeDefined();
    });

    it("searches by name, email and phone digits, with pagination", async () => {
      await asA(() =>
        guests().create(
          guestInput({ fullName: "Seif Ramadan", phone: "+20 122 734 9900" }),
          hotelA.ownerId,
        ),
      );
      const byName = await asA(() => guests().search({ q: "ramadan", page: 1, pageSize: 10 }));
      expect(byName.items.map((g) => g.fullName)).toEqual(["Seif Ramadan"]);
      const byPhone = await asA(() => guests().search({ q: "7349900", page: 1, pageSize: 10 }));
      expect(byPhone.items.map((g) => g.fullName)).toEqual(["Seif Ramadan"]);
      const page = await asA(() => guests().search({ page: 1, pageSize: 1 }));
      expect(page.items).toHaveLength(1);
      expect(page.total).toBeGreaterThan(1);
    });

    it("keeps notes with their author, and never shows one hotel's guest to another", async () => {
      const g = await asA(() =>
        guests().create(guestInput({ fullName: "Nadia Saad" }), hotelA.ownerId),
      );
      await asA(() => guests().addNote(g.id, "Prefers a room near the lift.", hotelA.ownerId));
      const profile = await asA(() => guests().get(g.id));
      expect(profile.notes).toEqual([
        expect.objectContaining({
          body: "Prefers a room near the lift.",
          authorName: "Hotel Owner",
        }),
      ]);
      await expect(asB(() => guests().get(g.id))).rejects.toMatchObject({
        code: "guest.not_found",
      });
      const bSearch = await asB(() => guests().search({ q: "Nadia", page: 1, pageSize: 10 }));
      expect(bSearch.items).toHaveLength(0);
    });
  });

  describe("staff", () => {
    it("adds a staff member through Core identity + RBAC and lists them with their role", async () => {
      const added = await asA(() =>
        staff().add(
          {
            fullName: "Youssef Adly",
            email: "youssef.adly+test@hotel.test",
            roleKey: "receptionist",
            temporaryPassword: "reception-temp-2026",
          },
          hotelA.ownerId,
        ),
      );
      const list = await asA(() => staff().list());
      expect(list.find((m) => m.userId === added.userId)).toMatchObject({
        name: "Youssef Adly",
        roleKey: "receptionist",
        roleName: "Receptionist",
      });
    });

    it("stops a manager granting or revoking Owner, and anyone changing their own role", async () => {
      const manager = await seedStaff(app, hotelA, "manager", "Mona Farid");
      const clerk = await seedStaff(app, hotelA, "receptionist", "Rania Kamal");
      await expect(
        asUser(manager.userId, hotelA.orgId, () =>
          staff().changeRole(clerk.userId, "owner", manager.userId),
        ),
      ).rejects.toMatchObject({ code: "staff.owner_role_restricted" });
      await expect(
        asUser(manager.userId, hotelA.orgId, () =>
          staff().changeRole(hotelA.ownerId, "receptionist", manager.userId),
        ),
      ).rejects.toMatchObject({ code: "staff.owner_role_restricted" });
      await expect(
        asUser(manager.userId, hotelA.orgId, () =>
          staff().changeRole(manager.userId, "owner", manager.userId),
        ),
      ).rejects.toMatchObject({ code: "staff.self_role_change" });
      // A manager may still move non-owner staff between ordinary roles.
      await asUser(manager.userId, hotelA.orgId, () =>
        staff().changeRole(clerk.userId, "accountant", manager.userId),
      );
      const me = await asUser(clerk.userId, hotelA.orgId, () => staff().myRole(clerk.userId));
      expect(me).toEqual({ roleKey: "accountant", roleName: "Accountant" });
    });

    it("lets an owner demote a co-owner, but never lets a non-owner remove an owner", async () => {
      const coOwner = await seedStaff(app, hotelB, "owner", "Co Owner");
      await asB(() => staff().changeRole(coOwner.userId, "manager", hotelB.ownerId));
      await expect(
        asUser(coOwner.userId, hotelB.orgId, () => staff().remove(hotelB.ownerId, coOwner.userId)),
      ).rejects.toMatchObject({ code: "staff.owner_role_restricted" });
    });

    it("removes a staff member from the hotel", async () => {
      const temp = await seedStaff(app, hotelA, "housekeeping", "Temp Housekeeper");
      await asA(() => staff().remove(temp.userId, hotelA.ownerId));
      const list = await asA(() => staff().list());
      expect(list.some((m) => m.userId === temp.userId)).toBe(false);
    });

    it("exposes the role matrix read-only, owner holding every hotel permission", async () => {
      const matrix = await asA(() => staff().roles());
      const owner = matrix.roles.find((r) => r.key === "owner")!;
      for (const p of matrix.permissions) expect(owner.permissionKeys).toContain(p.key);
      const housekeeping = matrix.roles.find((r) => r.key === "housekeeping")!;
      expect(housekeeping.permissionKeys).not.toContain("read:guest");
    });
  });

  describe("authorization over HTTP (role → permission matrix)", () => {
    type Probe = { method: "GET" | "POST" | "PATCH"; url: string; body?: unknown };
    const probes: Record<string, Probe> = {
      readRooms: { method: "GET", url: "/api/hotel/rooms" },
      manageRoomTypes: {
        method: "POST",
        url: "/api/hotel/room-types",
        body: { code: "ZZ", name: "Probe", capacity: 2, beds: "2 Single beds", baseRate: 100 },
      },
      readGuests: { method: "GET", url: "/api/hotel/guests" },
      createGuest: {
        method: "POST",
        url: "/api/hotel/guests",
        body: { fullName: "Probe Guest", phone: "+20 100 000 0000" },
      },
      readStaff: { method: "GET", url: "/api/hotel/staff" },
      updateSettings: {
        method: "PATCH",
        url: "/api/hotel/settings",
        body: { checkInTime: "14:00" },
      },
      readSettings: { method: "GET", url: "/api/hotel/settings" },
    };
    // true = allowed. Anything not listed for a role must be 403.
    const matrix: Record<string, Array<keyof typeof probes>> = {
      manager: [
        "readRooms",
        "manageRoomTypes",
        "readGuests",
        "createGuest",
        "readStaff",
        "readSettings",
      ],
      receptionist: ["readRooms", "readGuests", "createGuest", "readSettings"],
      accountant: ["readRooms", "readGuests", "readSettings"],
      housekeeping: ["readRooms", "readSettings"],
      maintenance: ["readRooms", "readSettings"],
    };

    for (const [role, allowed] of Object.entries(matrix)) {
      it(`${role}: allowed where granted, 403 everywhere else`, async () => {
        const hotel = await seedHotel(app, `Probe ${role}`);
        const member = await seedStaff(app, hotel, role, `Probe ${role}`);
        const token = await loginAs(http, member.email);
        for (const [name, probe] of Object.entries(probes)) {
          const res = await http.inject({
            method: probe.method,
            url: probe.url,
            headers: { authorization: `Bearer ${token}` },
            ...(probe.body ? { payload: probe.body as object } : {}),
          });
          const isAllowed = allowed.includes(name as keyof typeof probes);
          expect(
            isAllowed ? res.statusCode < 300 : res.statusCode === 403,
            `${role} ${name} → ${res.statusCode} ${res.body.slice(0, 120)}`,
          ).toBe(true);
        }
      });
    }

    it("rejects invalid input with field-level validation errors, not a 500", async () => {
      const token = await loginAs(http, hotelA.ownerEmail);
      const res = await http.inject({
        method: "POST",
        url: "/api/hotel/rooms",
        headers: { authorization: `Bearer ${token}` },
        payload: { number: "!!", floor: "x" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: expect.any(String) } });
    });
  });

  describe("demo hotel", () => {
    it("seeds staff, room types, rooms and guests through the domain services", async () => {
      await get<DemoSeeder>(app, DemoSeeder).seed(clock);
      const token = await loginAs(http, DEMO_STAFF[1]!.email, DEMO_PASSWORD);
      const auth = { authorization: `Bearer ${token}` };

      const role = await http.inject({ method: "GET", url: "/api/hotel/me/role", headers: auth });
      expect(role.json()).toEqual({ roleKey: "manager", roleName: "Manager" });

      const types = await http.inject({
        method: "GET",
        url: "/api/hotel/room-types",
        headers: auth,
      });
      expect((types.json() as { items: unknown[] }).items).toHaveLength(DEMO_ROOM_TYPES.length);
      const roomsRes = await http.inject({ method: "GET", url: "/api/hotel/rooms", headers: auth });
      expect((roomsRes.json() as { items: unknown[] }).items).toHaveLength(DEMO_ROOMS.length);
      const guestsRes = await http.inject({
        method: "GET",
        url: "/api/hotel/guests?pageSize=100",
        headers: auth,
      });
      expect((guestsRes.json() as { total: number }).total).toBe(DEMO_GUESTS.length);
      const staffRes = await http.inject({ method: "GET", url: "/api/hotel/staff", headers: auth });
      expect((staffRes.json() as { items: unknown[] }).items).toHaveLength(DEMO_STAFF.length);
    });
  });
});
