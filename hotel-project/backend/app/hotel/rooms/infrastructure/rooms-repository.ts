import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import type { HousekeepingStatus, ServiceStatus } from "../domain/room-status.js";

export interface RoomOccupancyRow {
  roomId: string;
  occupied: boolean;
  arrivingToday: boolean;
  guestName: string | null;
}

export interface RoomRecord {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  housekeepingStatus: HousekeepingStatus;
  serviceStatus: ServiceStatus;
  notes: string | null;
  archivedAt: Date | null;
}

export interface RoomFilter {
  roomTypeId?: string;
  floor?: number;
  housekeepingStatus?: HousekeepingStatus;
  serviceStatus?: ServiceStatus;
  includeArchived?: boolean;
}

export interface RoomInput {
  number: string;
  floor: number;
  roomTypeId: string;
  notes?: string | null;
}

@Injectable()
export class RoomsRepository {
  private base() {
    return hotelDb()
      .selectFrom("hotel_rooms as r")
      .innerJoin("hotel_room_types as t", (j) =>
        j.onRef("t.id", "=", "r.room_type_id").onRef("t.organization_id", "=", "r.organization_id"),
      )
      .where("r.organization_id", "=", requireOrganizationId())
      .select([
        "r.id",
        "r.number",
        "r.floor",
        "r.room_type_id",
        "t.name as room_type_name",
        "t.code as room_type_code",
        "r.housekeeping_status",
        "r.service_status",
        "r.notes",
        "r.archived_at",
      ]);
  }

  async list(filter: RoomFilter = {}): Promise<RoomRecord[]> {
    let q = this.base();
    if (!filter.includeArchived) q = q.where("r.archived_at", "is", null);
    if (filter.roomTypeId) q = q.where("r.room_type_id", "=", filter.roomTypeId);
    if (filter.floor !== undefined) q = q.where("r.floor", "=", filter.floor);
    if (filter.housekeepingStatus) {
      q = q.where("r.housekeeping_status", "=", filter.housekeepingStatus);
    }
    if (filter.serviceStatus) q = q.where("r.service_status", "=", filter.serviceStatus);
    // Natural order: by floor, then shorter numbers first so 102 sorts before 1010.
    const rows = await q
      .orderBy("r.floor")
      .orderBy((eb) => eb.fn("length", ["r.number"]))
      .orderBy("r.number")
      .execute();
    return rows.map((r) => this.toRecord(r));
  }

  async findById(id: string): Promise<RoomRecord | null> {
    const row = await this.base().where("r.id", "=", id).executeTakeFirst();
    return row ? this.toRecord(row) : null;
  }

  async create(input: RoomInput): Promise<string> {
    const id = hotelId("rom");
    await hotelDb()
      .insertInto("hotel_rooms")
      .values({
        id,
        organization_id: requireOrganizationId(),
        number: input.number,
        floor: input.floor,
        room_type_id: input.roomTypeId,
        notes: input.notes ?? null,
      })
      .execute();
    return id;
  }

  async update(id: string, patch: Partial<RoomInput>): Promise<void> {
    await hotelDb()
      .updateTable("hotel_rooms")
      .set({
        ...(patch.number !== undefined && { number: patch.number }),
        ...(patch.floor !== undefined && { floor: patch.floor }),
        ...(patch.roomTypeId !== undefined && { room_type_id: patch.roomTypeId }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
      })
      .where("organization_id", "=", requireOrganizationId())
      .where("id", "=", id)
      .execute();
  }

  async archive(id: string, at: Date): Promise<void> {
    await hotelDb()
      .updateTable("hotel_rooms")
      .set({ archived_at: at })
      .where("organization_id", "=", requireOrganizationId())
      .where("id", "=", id)
      .execute();
  }

  /**
   * Tonight's occupancy per room, read from the allocation ledger: a checked-in stay covering
   * `today` = occupied; a confirmed arrival due `today` = arriving. A read model only — status
   * changes never happen here.
   */
  async occupancy(today: IsoDate): Promise<Map<string, RoomOccupancyRow>> {
    const org = requireOrganizationId();
    const rows = await sql<{
      room_id: string;
      status: string;
      arrival: string;
      guest_name: string;
    }>`
      SELECT a.room_id, r.status, r.arrival::text AS arrival, g.full_name AS guest_name
        FROM hotel_room_allocations a
        JOIN hotel_reservations r ON r.organization_id = a.organization_id AND r.id = a.reservation_id
        JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
       WHERE a.organization_id = ${org}
         AND a.active
         AND a.stay @> ${today}::date
         AND r.status IN ('checked_in', 'confirmed')
    `.execute(hotelDb());
    const map = new Map<string, RoomOccupancyRow>();
    for (const row of rows.rows) {
      const occupied = row.status === "checked_in";
      const arrivingToday = row.status === "confirmed" && row.arrival === today;
      if (!occupied && !arrivingToday) continue;
      map.set(row.room_id, {
        roomId: row.room_id,
        occupied,
        arrivingToday,
        guestName: row.guest_name,
      });
    }
    return map;
  }

  private toRecord(r: {
    id: string;
    number: string;
    floor: number;
    room_type_id: string;
    room_type_name: string;
    room_type_code: string;
    housekeeping_status: HousekeepingStatus;
    service_status: ServiceStatus;
    notes: string | null;
    archived_at: Date | null;
  }): RoomRecord {
    return {
      id: r.id,
      number: r.number,
      floor: r.floor,
      roomTypeId: r.room_type_id,
      roomTypeName: r.room_type_name,
      roomTypeCode: r.room_type_code,
      housekeepingStatus: r.housekeeping_status,
      serviceStatus: r.service_status,
      notes: r.notes,
      archivedAt: r.archived_at,
    };
  }
}
