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
import { ClientsModule } from "@app/lawfirm/clients/clients.module.js";
import { MattersModule } from "@app/lawfirm/matters/matters.module.js";
import { HearingsModule } from "@app/lawfirm/hearings/hearings.module.js";
import { TasksModule } from "@app/lawfirm/tasks/tasks.module.js";
import { DocumentsModule } from "@app/lawfirm/documents/documents.module.js";
import { BillingModule } from "@app/lawfirm/billing/billing.module.js";
import { CalendarModule } from "@app/lawfirm/calendar/calendar.module.js";
import { DashboardModule } from "@app/lawfirm/dashboard/dashboard.module.js";
import { AssistantController } from "./assistant.controller.js";
import { mizanScopeVocabulary } from "./scope-vocabulary.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { ReadTools } from "./tools/read-tools.js";
import { WriteTools } from "./tools/write-tools.js";

/**
 * Mizan Copilot (mizan/backend/app/lawfirm/assistant) — the AI orchestration
 * layer. Domain-specific: its 21 tools call the existing law-firm services
 * directly (the same path a screen uses), its system prompt and scope
 * vocabulary describe Mizan's own domain. The orchestration mechanism itself
 * (agent loop, tool registry, conversation store, scope-gate engine) is
 * AURIC Core's `core/assistant` (core/assistant/README.md) — this module only
 * supplies the bindings Core asks for via `ASSISTANT_TOOLS`,
 * `ASSISTANT_DOMAIN_CONFIG`, and `SCOPE_GUARD_CONFIG`.
 *
 * See docs/assistant.md.
 */
@Module({
  imports: [
    IdentityModule,
    RbacModule,
    OrganizationsModule,
    AuditModule,
    ClientsModule,
    MattersModule,
    HearingsModule,
    TasksModule,
    DocumentsModule,
    BillingModule,
    CalendarModule,
    DashboardModule,
  ],
  controllers: [AssistantController],
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
      useValue: { domainKey: "lawfirm", buildSystemPrompt },
    },
    { provide: SCOPE_GUARD_CONFIG, useValue: mizanScopeVocabulary },
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
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
