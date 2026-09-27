import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { GuestsController } from "./api/guests.controller.js";
import { GuestsService } from "./application/guests-service.js";
import { GuestsRepository } from "./infrastructure/guests-repository.js";

@Module({
  imports: [AuditModule, HotelSharedModule],
  controllers: [GuestsController],
  providers: [GuestsRepository, GuestsService],
  exports: [GuestsRepository, GuestsService],
})
export class GuestsModule {}
