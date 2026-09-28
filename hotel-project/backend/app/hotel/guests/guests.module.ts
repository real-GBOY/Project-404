import { Module } from "@nestjs/common";
import { AuditModule, FilesModule, IdentityModule } from "@core/index.js";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";
import { GuestsController } from "./api/guests.controller.js";
import { GuestDocumentsController } from "./api/guest-documents.controller.js";
import { GuestsService } from "./application/guests-service.js";
import { GuestDocumentsService } from "./application/guest-documents-service.js";
import { GuestsRepository } from "./infrastructure/guests-repository.js";
import { GuestDocumentsRepository } from "./infrastructure/guest-documents-repository.js";

@Module({
  imports: [AuditModule, FilesModule, IdentityModule, HotelSharedModule],
  controllers: [GuestsController, GuestDocumentsController],
  providers: [GuestsRepository, GuestsService, GuestDocumentsRepository, GuestDocumentsService],
  exports: [GuestsRepository, GuestsService],
})
export class GuestsModule {}
