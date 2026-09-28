import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import { moneyNumber, moneyString } from "@hotel/hotel/shared/money.js";

export interface RoomTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  beds: string;
  baseRate: number;
  amenities: string[];
  sortOrder: number;
  archivedAt: Date | null;
  /** Active (non-archived) rooms of this type. */
  roomCount: number;
}

export interface RoomTypeInput {
  code: string;
  name: string;
  description?: string | null;
  capacity: number;
  beds: string;
  baseRate: number;
  amenities: string[];
  sortOrder: number;
}

export type RoomTypePatch = Partial<Omit<RoomTypeInput, "code">>;

@Injectable()
export class RoomTypesRepository {
  private base() {
    const org = requireOrganizationId();
    return hotelDb()
      .selectFrom("hotel_room_types as t")
      .where("t.organization_id", "=", org)
      .selectAll("t")
      .select((eb) =>
        eb
          .selectFrom("hotel_rooms as r")
          .whereRef("r.room_type_id", "=", "t.id")
          .where("r.organization_id", "=", org)
          .where("r.archived_at", "is", null)
          .select(eb.fn.countAll<string>().as("n"))
          .as("room_count"),
      );
  }

  async list(includeArchived: boolean): Promise<RoomTypeRow[]> {
    let q = this.base();
    if (!includeArchived) q = q.where("t.archived_at", "is", null);
    const rows = await q.orderBy("t.sort_order").orderBy("t.name").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<RoomTypeRow | null> {
    const row = await this.base().where("t.id", "=", id).executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: RoomTypeInput): Promise<string> {
    const id = hotelId("rmt");
    await hotelDb()
      .insertInto("hotel_room_types")
      .values({
        id,
        organization_id: requireOrganizationId(),
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        capacity: input.capacity,
        beds: input.beds,
        base_rate: moneyString(input.baseRate),
        amenities: JSON.stringify(input.amenities),
        sort_order: input.sortOrder,
      })
      .execute();
    return id;
  }

  async update(id: string, patch: RoomTypePatch): Promise<void> {
    await hotelDb()
      .updateTable("hotel_room_types")
      .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.capacity !== undefined && { capacity: patch.capacity }),
        ...(patch.beds !== undefined && { beds: patch.beds }),
        ...(patch.baseRate !== undefined && { base_rate: moneyString(patch.baseRate) }),
        ...(patch.amenities !== undefined && { amenities: JSON.stringify(patch.amenities) }),
        ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }),
      })
      .where("organization_id", "=", requireOrganizationId())
      .where("id", "=", id)
      .execute();
  }

  async archive(id: string, at: Date): Promise<void> {
    await hotelDb()
      .updateTable("hotel_room_types")
      .set({ archived_at: at })
      .where("organization_id", "=", requireOrganizationId())
      .where("id", "=", id)
      .execute();
  }

  private toRow(r: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    capacity: number;
    beds: string;
    base_rate: string;
    amenities: string[];
    sort_order: number;
    archived_at: Date | null;
    room_count: string | null;
  }): RoomTypeRow {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      capacity: r.capacity,
      beds: r.beds,
      baseRate: moneyNumber(r.base_rate),
      amenities: r.amenities,
      sortOrder: r.sort_order,
      archivedAt: r.archived_at,
      roomCount: Number(r.room_count ?? 0),
    };
  }
}
