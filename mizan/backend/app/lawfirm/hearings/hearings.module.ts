import { Module } from "@nestjs/common";
import { AuditModule, EventsModule, IdentityModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { HearingsController } from "./hearings.controller.js";
import { HearingsRepository } from "./hearings-repository.js";
import { HearingsService } from "./hearings-service.js";

@Module({
  imports: [LawfirmSharedModule, IdentityModule, AuditModule, EventsModule],
  controllers: [HearingsController],
  providers: [HearingsRepository, HearingsService],
  exports: [HearingsRepository],
})
export class HearingsModule {}
