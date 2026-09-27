import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import {
  RoomTypesRepository,
  type RoomTypeInput,
  type RoomTypePatch,
  type RoomTypeRow,
} from "../infrastructure/room-types-repository.js";

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly repo: RoomTypesRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(includeArchived = false): Promise<RoomTypeRow[]> {
    return readInTenant(() => this.repo.list(includeArchived));
  }

  async get(id: string): Promise<RoomTypeRow> {
    const row = await readInTenant(() => this.repo.findById(id));
    if (!row) throw NotFound("room_type.not_found", "Room type not found.");
    return row;
  }

  async create(input: RoomTypeInput, actorId: string): Promise<RoomTypeRow> {
    try {
      return await this.uow.transaction(async () => {
        const id = await this.repo.create(input);
        const created = (await this.repo.findById(id))!;
        await this.audit.record({
          actorId,
          action: "hotel.room_type.created",
          resourceType: "hotel_room_type",
          resourceId: id,
          after: created,
        });
        return created;
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_room_types_code_uq")) {
        throw Conflict(
          "room_type.code_taken",
          `A room type with code ${input.code} already exists.`,
        );
      }
      throw err;
    }
  }

  update(id: string, patch: RoomTypePatch, actorId: string): Promise<RoomTypeRow> {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("room_type.not_found", "Room type not found.");
      if (before.archivedAt) throw Conflict("room_type.archived", "This room type is archived.");
      await this.repo.update(id, patch);
      const after = (await this.repo.findById(id))!;
      await this.audit.record({
        actorId,
        action: "hotel.room_type.updated",
        resourceType: "hotel_room_type",
        resourceId: id,
        before,
        after,
      });
      return after;
    });
  }

  /** A type can only be retired once no active room uses it. */
  archive(id: string, actorId: string): Promise<RoomTypeRow> {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("room_type.not_found", "Room type not found.");
      if (before.archivedAt) return before;
      if (before.roomCount > 0) {
        throw Conflict(
          "room_type.in_use",
          `${before.roomCount} active room(s) still use this type — move or archive them first.`,
        );
      }
      await this.repo.archive(id, this.clock.now());
      await this.audit.record({
        actorId,
        action: "hotel.room_type.archived",
        resourceType: "hotel_room_type",
        resourceId: id,
        before,
      });
      return (await this.repo.findById(id))!;
    });
  }
}
