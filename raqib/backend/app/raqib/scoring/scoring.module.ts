import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ScoringController } from "./api/scoring.controller.js";
import { ScoringService } from "./application/scoring-service.js";
import { ScoringRepository } from "./infrastructure/scoring-repository.js";

@Module({
  imports: [AuditModule, AccessModule],
  controllers: [ScoringController],
  providers: [ScoringRepository, ScoringService],
  exports: [ScoringRepository, ScoringService],
})
export class ScoringModule {}
