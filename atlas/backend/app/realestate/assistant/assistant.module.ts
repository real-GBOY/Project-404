import { Module } from "@nestjs/common";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { FinanceModule } from "@atlas/realestate/finance/finance.module.js";
import { AssistantController } from "./assistant.controller.js";
import { AssistantRepository } from "./assistant-repository.js";
import { AssistantService } from "./assistant-service.js";
import { InsightsController } from "./insights.controller.js";
import { InsightsRepository } from "./insights-repository.js";
import { InsightsService } from "./insights-service.js";

@Module({
  imports: [PropertiesModule, FinanceModule],
  controllers: [AssistantController, InsightsController],
  providers: [AssistantRepository, AssistantService, InsightsRepository, InsightsService],
  exports: [InsightsRepository],
})
export class AssistantModule {}
