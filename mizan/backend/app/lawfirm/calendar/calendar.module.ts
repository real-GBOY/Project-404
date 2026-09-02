import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { HearingsModule } from "@app/lawfirm/hearings/hearings.module.js";
import { TasksModule } from "@app/lawfirm/tasks/tasks.module.js";
import { CalendarController } from "./calendar.controller.js";
import { CalendarRepository } from "./calendar-repository.js";
import { CalendarService } from "./calendar-service.js";

@Module({
  imports: [LawfirmSharedModule, HearingsModule, TasksModule, IdentityModule],
  controllers: [CalendarController],
  providers: [CalendarRepository, CalendarService],
  exports: [CalendarRepository],
})
export class CalendarModule {}
