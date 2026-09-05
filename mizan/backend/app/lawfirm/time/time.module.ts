import { Module } from "@nestjs/common";
import { EventsModule, IdentityModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { SettingsModule } from "@app/lawfirm/settings/settings.module.js";
import { TimeController } from "./time.controller.js";
import { TimeRepository } from "./time-repository.js";
import { TimeService } from "./time-service.js";

@Module({
  imports: [LawfirmSharedModule, IdentityModule, EventsModule, SettingsModule],
  controllers: [TimeController],
  providers: [TimeRepository, TimeService],
  exports: [TimeRepository],
})
export class TimeModule {}
