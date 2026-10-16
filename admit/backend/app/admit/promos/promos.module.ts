import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";
import { PromosController } from "./api/promos.controller.js";
import { PromosService } from "./application/promos-service.js";
import { PromosRepository } from "./infrastructure/promos-repository.js";

/** Discount codes: the organizer defines them per event, the booking flow prices them. */
@Module({
  imports: [AuditModule, AdmitEventsModule],
  controllers: [PromosController],
  providers: [PromosRepository, PromosService],
  exports: [PromosService, PromosRepository],
})
export class PromosModule {}
