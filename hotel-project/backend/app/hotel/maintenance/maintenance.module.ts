import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, RbacModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { MaintenanceController } from "./api/maintenance.controller.js";
import { MaintenanceService } from "./application/maintenance-service.js";
import { MaintenanceRepository } from "./infrastructure/maintenance-repository.js";

@Module({
  imports: [
    AuditModule,
    EventsModule,
    RbacModule,
    HotelSharedModule,
    SettingsModule,
    RoomsModule,
    ReservationsModule,
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceRepository, MaintenanceService],
  exports: [MaintenanceRepository, MaintenanceService],
})
export class MaintenanceModule {}
