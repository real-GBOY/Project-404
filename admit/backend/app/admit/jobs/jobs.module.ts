import { Module } from "@nestjs/common";
import { EventsModule } from "@core/index.js";
import { BookingsStoreModule } from "@admit/admit/bookings/bookings-store.module.js";
import { BookingsModule } from "@admit/admit/bookings/bookings.module.js";
import { PublicModule } from "@admit/admit/public/public.module.js";
import { AdmitJobs } from "./application/admit-jobs.js";
import { JobsRunner } from "./application/jobs-runner.js";

/** Scheduled jobs: booking-hold expiry and rate-limit pruning (see AdmitJobs). */
@Module({
  imports: [EventsModule, BookingsStoreModule, BookingsModule, PublicModule],
  providers: [AdmitJobs, JobsRunner],
  exports: [AdmitJobs, JobsRunner],
})
export class JobsModule {}
