import { Module } from "@nestjs/common";
import { AuditModule, EventsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { ReviewController } from "./api/review.controller.js";
import { ReviewService } from "./application/review-service.js";

@Module({
  imports: [AuditModule, EventsModule, AccessModule, InspectionsModule, VisitsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
