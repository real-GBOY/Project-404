import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, IdentityModule } from "../../../../../core/index.js";
import { LawfirmSharedModule } from "../shared/shared.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { MattersController } from "./matters.controller.js";
import { MattersRepository } from "./matters-repository.js";
import { MattersService } from "./matters-service.js";

@Module({
  imports: [LawfirmSharedModule, SettingsModule, IdentityModule, AuditModule, EventsModule],
  controllers: [MattersController],
  providers: [MattersRepository, MattersService],
  exports: [MattersRepository],
})
export class MattersModule {}
