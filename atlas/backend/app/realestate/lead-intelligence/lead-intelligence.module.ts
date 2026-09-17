import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { AssistantModule } from "@atlas/realestate/assistant/assistant.module.js";
import { LeadIntelligenceController } from "./api/lead-intelligence.controller.js";
import { StructuredAi } from "./application/structured-ai.js";
import { LeadIntelligenceService } from "./application/lead-intelligence-service.js";

/**
 * Atlas AI Lead Intelligence & Property Matching (docs/lead-intelligence.md).
 * A composition module over CRM (leads — read + the one write of persisting
 * extracted requirements) and Properties (units/projects/buildings — read
 * only), reusing the Atlas Copilot's AI client boundary from `AssistantModule`
 * rather than standing up a second one. Same shape as `DashboardModule`:
 * no table of its own beyond the three columns added to `realestate_leads`.
 */
@Module({
  imports: [CrmModule, PropertiesModule, AssistantModule, AuditModule],
  controllers: [LeadIntelligenceController],
  providers: [StructuredAi, LeadIntelligenceService],
  exports: [LeadIntelligenceService],
})
export class LeadIntelligenceModule {}
