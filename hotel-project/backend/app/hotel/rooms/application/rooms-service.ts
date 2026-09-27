import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { displayStatus, NO_OCCUPANCY, type RoomDisplayStatus } from "../domain/room-status.js";
import { RoomTypesRepository } from "../infrastructure/room-types-repository.js";
import {
  RoomsRepository,
  type RoomFilter,
  type RoomInput,
  type RoomOccupancyRow,
  type RoomRecord,
} from "../infrastructure/rooms-repository.js";

export interface RoomView extends RoomRecord {
  /** Derived for the rooms board — never stored (docs/architecture.md §4). */
  displayStatus: RoomDisplayStatus;
  /** The in-house or arriving guest tonight, if any. */
  currentGuest: string | null;
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly repo: RoomsRepository,
    private readonly roomTypes: RoomTypesRepository,
    private readonly settings: SettingsService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(filter: RoomFilter = {}): Promise<RoomView[]> {
    return readInTenant(async () => {
      const [rooms, occupancy] = await Promise.all([
        this.repo.list(filter),
        this.settings.today().then((d) => this.repo.occupancy(d)),
      ]);
      return rooms.map((r) => this.view(r, occupancy.get(r.id)));
    });
  }

  async get(id: string): Promise<RoomView> {
    return readInTenant(async () => {
      const room = await this.repo.findById(id);
      if (!room) throw NotFound("room.not_found", "Room not found.");
      const occupancy = await this.repo.occupancy(await this.settings.today());
      return this.view(room, occupancy.get(id));
    });
  }

  async create(input: RoomInput, actorId: string): Promise<RoomView> {
    try {
      return await this.uow.transaction(async () => {
        await this.requireActiveType(input.roomTypeId);
        const id = await this.repo.create(input);
        const created = (await this.repo.findById(id))!;
        await this.audit.record({
          actorId,
          action: "hotel.room.created",
          resourceType: "hotel_room",
          resourceId: id,
          after: created,
        });
        return this.view(created);
      });
    } catch (err) {
      throw this.translate(err, input.number);
    }
  }

  async update(id: string, patch: Partial<RoomInput>, actorId: string): Promise<RoomView> {
    try {
      return await this.uow.transaction(async () => {
        const before = await this.repo.findById(id);
        if (!before) throw NotFound("room.not_found", "Room not found.");
        if (before.archivedAt) throw Conflict("room.archived", "This room is archived.");
        if (patch.roomTypeId && patch.roomTypeId !== before.roomTypeId) {
          await this.requireActiveType(patch.roomTypeId);
        }
        await this.repo.update(id, patch);
        const after = (await this.repo.findById(id))!;
        await this.audit.record({
          actorId,
          action: "hotel.room.updated",
          resourceType: "hotel_room",
          resourceId: id,
          before,
          after,
        });
        return this.view(after);
      });
    } catch (err) {
      throw this.translate(err, patch.number);
    }
  }

  archive(id: string, actorId: string): Promise<RoomView> {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("room.not_found", "Room not found.");
      if (!before.archivedAt) {
        await this.repo.archive(id, this.clock.now());
        await this.audit.record({
          actorId,
          action: "hotel.room.archived",
          resourceType: "hotel_room",
          resourceId: id,
          before,
        });
      }
      return this.view((await this.repo.findById(id))!);
    });
  }

  private async requireActiveType(roomTypeId: string): Promise<void> {
    const type = await this.roomTypes.findById(roomTypeId);
    if (!type) throw ValidationError("room.unknown_room_type", "That room type does not exist.");
    if (type.archivedAt) {
      throw ValidationError("room.room_type_archived", "That room type is archived.");
    }
  }

  private translate(err: unknown, number: string | undefined): unknown {
    if (isUniqueViolation(err, "hotel_rooms_number_uq")) {
      return Conflict("room.number_taken", `Room ${number ?? ""} already exists.`.trim());
    }
    return err;
  }

  private view(room: RoomRecord, occupancy?: RoomOccupancyRow): RoomView {
    return {
      ...room,
      displayStatus: displayStatus(
        room.housekeepingStatus,
        room.serviceStatus,
        occupancy ?? NO_OCCUPANCY,
      ),
      currentGuest: occupancy?.guestName ?? null,
    };
  }
}
