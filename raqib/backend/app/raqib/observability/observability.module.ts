import { Global, Module } from "@nestjs/common";
import { EventsModule } from "@core/index.js";
import { JobsModule } from "@raqib/raqib/jobs/jobs.module.js";
import { ReportsModule } from "@raqib/raqib/reports/reports.module.js";
import { AlertService, AlertingErrorTracker } from "./alerts.js";
import { ObservabilityController } from "./observability.controller.js";

/** Global so the jobs runner and the exception filter can raise alerts without importing this module. */
@Global()
@Module({
  imports: [EventsModule, JobsModule, ReportsModule],
  controllers: [ObservabilityController],
  providers: [AlertService, AlertingErrorTracker, { provide: "RAQIB_BOOTED_AT", useValue: Date.now() }],
  exports: [AlertService, AlertingErrorTracker],
})
export class ObservabilityModule {}
