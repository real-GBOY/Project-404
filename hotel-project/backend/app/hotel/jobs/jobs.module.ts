import { Module } from "@nestjs/common";
import { EventsModule } from "@core/index.js";
import { SettingsModule } from "@hotel/hotel/settings/settings.module.js";
import { ReservationsModule } from "@hotel/hotel/reservations/reservations.module.js";
import { PublicModule } from "@hotel/hotel/public/public.module.js";
import { HotelJobs } from "./application/hotel-jobs.js";
import { JobsRunner } from "./application/jobs-runner.js";

/** Scheduled jobs: auto no-show and hold expiry (see HotelJobs). */
@Module({
  imports: [EventsModule, SettingsModule, ReservationsModule, PublicModule],
  providers: [HotelJobs, JobsRunner],
  exports: [HotelJobs, JobsRunner],
})
export class JobsModule {}
