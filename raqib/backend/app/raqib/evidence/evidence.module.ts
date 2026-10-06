import { Module } from "@nestjs/common";
import { AuditModule, FilesModule } from "@core/index.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { EvidenceController } from "./api/evidence.controller.js";
import { EvidenceService } from "./application/evidence-service.js";

@Module({
  imports: [AuditModule, FilesModule, ActionsModule, AccessModule, InspectionsModule, SettingsModule, VisitsModule, SharedModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
