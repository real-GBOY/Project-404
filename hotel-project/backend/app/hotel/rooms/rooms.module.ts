import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { RoomTypesController } from "./api/room-types.controller.js";
import { RoomsController } from "./api/rooms.controller.js";
import { RoomTypesService } from "./application/room-types-service.js";
import { RoomsService } from "./application/rooms-service.js";
import { RoomTypesRepository } from "./infrastructure/room-types-repository.js";
import { RoomsRepository } from "./infrastructure/rooms-repository.js";

@Module({
  imports: [AuditModule],
  controllers: [RoomTypesController, RoomsController],
  providers: [RoomTypesRepository, RoomsRepository, RoomTypesService, RoomsService],
  exports: [RoomTypesRepository, RoomsRepository, RoomTypesService, RoomsService],
})
export class RoomsModule {}
