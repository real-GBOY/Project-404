import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { RoomsModule } from "@hotel/hotel/rooms/rooms.module.js";
import { PricingController } from "./api/pricing.controller.js";
import { PricingService } from "./application/pricing-service.js";
import { PricingRepository } from "./infrastructure/pricing-repository.js";

@Module({
  imports: [AuditModule, RoomsModule],
  controllers: [PricingController],
  providers: [PricingRepository, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
