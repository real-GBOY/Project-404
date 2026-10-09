import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ConfidentialModule } from "@raqib/raqib/confidential/confidential.module.js";
import { ScoringModule } from "@raqib/raqib/scoring/scoring.module.js";
import { SurveysController } from "./api/surveys.controller.js";
import { SurveysService } from "./application/surveys-service.js";
import { SurveysRepository } from "./infrastructure/surveys-repository.js";

@Module({
  imports: [AuditModule, AccessModule, ConfidentialModule, ScoringModule],
  controllers: [SurveysController],
  providers: [SurveysRepository, SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
