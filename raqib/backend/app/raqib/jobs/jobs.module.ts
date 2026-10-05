import { Module } from "@nestjs/common";
import { EventsModule } from "@core/index.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { JobsRunner } from "./jobs-runner.js";
import { RaqibJobs } from "./raqib-jobs.js";

/** Scheduled jobs: overdue visits (see RaqibJobs). */
@Module({
  imports: [EventsModule, SettingsModule, VisitsModule, ActionsModule],
  providers: [RaqibJobs, JobsRunner],
  exports: [RaqibJobs, JobsRunner],
})
export class JobsModule {}
