import { Module } from "@nestjs/common";
import {
  AI_CLIENT,
  ASSISTANT_CONFIG,
  ASSISTANT_DOMAIN_CONFIG,
  ASSISTANT_TOOLS,
  AssistantService,
  AuditModule,
  type AuricConfig,
  CONFIG,
  ConversationRepository,
  IdentityModule,
  OpenAiCompatibleClient,
  OrganizationsModule,
  RbacModule,
  SCOPE_GUARD_CONFIG,
  ScopeGuard,
  ToolRegistry,
  assistantConfigFromAuricConfig,
} from "@core/index.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { PropertiesModule } from "@atlas/realestate/properties/properties.module.js";
import { SalesModule } from "@atlas/realestate/sales/sales.module.js";
import { FinanceModule } from "@atlas/realestate/finance/finance.module.js";
import { OperationsModule } from "@atlas/realestate/operations/operations.module.js";
import { DashboardModule } from "@atlas/realestate/dashboard/dashboard.module.js";
import { AssistantController } from "./assistant.controller.js";
import { atlasScopeVocabulary } from "./scope-vocabulary.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { ReadTools } from "./tools/read-tools.js";
import { WriteTools } from "./tools/write-tools.js";
import { InsightsController } from "./insights.controller.js";
import { InsightsRepository } from "./insights-repository.js";
import { InsightsService } from "./insights-service.js";

/**
 * Atlas Copilot (atlas/backend/app/realestate/assistant) — the AI
 * orchestration layer. Domain-specific: its 22 tools call the existing
 * real-estate services directly (the same path a screen uses), its system
 * prompt and scope vocabulary describe Atlas's own domain. The orchestration
 * mechanism itself (agent loop, tool registry, conversation store, scope-gate
 * engine) is AURIC Core's `core/assistant` (core/assistant/README.md) — this
 * module only supplies the bindings Core asks for via `ASSISTANT_TOOLS`,
 * `ASSISTANT_DOMAIN_CONFIG`, and `SCOPE_GUARD_CONFIG`.
 *
 * `InsightsController`/`InsightsRepository`/`InsightsService` are a separate,
 * unrelated feature (the dashboard's pre-generated "AI Insights" banner) that
 * has always lived in this module — untouched by this refactor.
 *
 * See docs/atlas-assistant.md.
 */
@Module({
  imports: [
    IdentityModule,
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
    ReadTools,
    WriteTools,
    {
      provide: ASSISTANT_TOOLS,
      inject: [ReadTools, WriteTools],
      useFactory: (readTools: ReadTools, writeTools: WriteTools) => [
        ...readTools.tools(),
        ...writeTools.tools(),
      ],
    },
    {
      provide: ASSISTANT_DOMAIN_CONFIG,
      useValue: { domainKey: "realestate", buildSystemPrompt },
    },
    { provide: SCOPE_GUARD_CONFIG, useValue: atlasScopeVocabulary },
    { provide: AI_CLIENT, useClass: OpenAiCompatibleClient },
    {
      provide: ASSISTANT_CONFIG,
      inject: [CONFIG],
      useFactory: (cfg: AuricConfig) => assistantConfigFromAuricConfig(cfg),
    },
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
