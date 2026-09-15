import { Module } from "@nestjs/common";
import { AuditModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { RealestateSharedModule } from "@atlas/realestate/shared/shared.module.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { FinanceModule } from "@atlas/realestate/finance/finance.module.js";
import { OperationsModule } from "@atlas/realestate/operations/operations.module.js";
import { DashboardModule } from "@atlas/realestate/dashboard/dashboard.module.js";
import { AI_CLIENT } from "./ai/ai-client.js";
import { OpenAiCompatibleClient } from "./ai/openai-compatible-client.js";
import { ASSISTANT_CONFIG, readAssistantConfig } from "./assistant-config.js";
import { AssistantController } from "./assistant.controller.js";
import { AssistantService } from "./assistant-service.js";
import { ConversationRepository } from "./conversation-repository.js";
import { ScopeGuard } from "./scope-guard.js";
import { ReadTools } from "./tools/read-tools.js";
import { ToolRegistry } from "./tools/tool-registry.js";
import { WriteTools } from "./tools/write-tools.js";
import { InsightsController } from "./insights.controller.js";
import { InsightsRepository } from "./insights-repository.js";
import { InsightsService } from "./insights-service.js";

/**
 * Atlas Copilot (atlas/backend/app/realestate/assistant) — the AI
 * orchestration layer. It composes the existing real-estate feature modules so
 * its tools can call their services directly (the same path a screen uses), and
 * reaches Core only through the standard provider tokens (`PERMISSION_PROVIDER`,
 * `ORGANIZATION_PROVIDER`, `AUDIT_LOGGER`). Nothing here is promoted to Core.
 *
 * `InsightsController`/`InsightsRepository`/`InsightsService` are a separate,
 * unrelated feature (the dashboard's pre-generated "AI Insights" banner) that
 * has always lived in this module — untouched by the chat upgrade.
 *
 * See docs/atlas-assistant.md.
 */
@Module({
  imports: [
    RealestateSharedModule,
    RbacModule,
    OrganizationsModule,
    AuditModule,
    CrmModule,
    PropertiesModule,
    SalesModule,
    FinanceModule,
    OperationsModule,
    DashboardModule,
  ],
  controllers: [AssistantController, InsightsController],
  providers: [
    { provide: ASSISTANT_CONFIG, useFactory: () => readAssistantConfig() },
    { provide: AI_CLIENT, useClass: OpenAiCompatibleClient },
    ReadTools,
    WriteTools,
    ToolRegistry,
    ScopeGuard,
    ConversationRepository,
    AssistantService,
    InsightsRepository,
    InsightsService,
  ],
  exports: [InsightsRepository],
})
export class AssistantModule {}
