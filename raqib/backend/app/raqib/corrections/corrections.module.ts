import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { ScoringModule } from "@raqib/raqib/scoring/scoring.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { CorrectionsController } from "./api/corrections.controller.js";
import { CorrectionsService } from "./application/corrections-service.js";
import { CorrectionsRepository } from "./infrastructure/corrections-repository.js";

@Module({
  imports: [AuditModule, AccessModule, InspectionsModule, ScoringModule, VisitsModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsRepository, CorrectionsService],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
