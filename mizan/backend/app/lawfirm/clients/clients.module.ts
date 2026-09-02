import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, IdentityModule } from "../../../../../core/index.js";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { ClientsController } from "./clients.controller.js";
import { ClientsRepository } from "./clients-repository.js";
import { ClientsService } from "./clients-service.js";

@Module({
  imports: [LawfirmSharedModule, IdentityModule, AuditModule, EventsModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsRepository],
})
export class ClientsModule {}
