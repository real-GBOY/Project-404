import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, RbacModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { HousekeepingController } from "./api/housekeeping.controller.js";
import { HousekeepingService } from "./application/housekeeping-service.js";
import { HousekeepingRepository } from "./infrastructure/housekeeping-repository.js";

@Module({
  imports: [AuditModule, EventsModule, RbacModule, HotelSharedModule, SettingsModule, RoomsModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingRepository, HousekeepingService],
  exports: [HousekeepingRepository, HousekeepingService],
})
export class HousekeepingModule {}
