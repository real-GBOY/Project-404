import { Module } from "@nestjs/common";
import { AuditModule, OrganizationsModule, RbacModule } from "@core/index.js";
import { LawfirmSharedModule } from "@app/lawfirm/shared/shared.module.js";
import { ClientsModule } from "@app/lawfirm/clients/clients.module.js";
import { MattersModule } from "@app/lawfirm/matters/matters.module.js";
import { HearingsModule } from "@app/lawfirm/hearings/hearings.module.js";
import { TasksModule } from "@app/lawfirm/tasks/tasks.module.js";
import { DocumentsModule } from "@app/lawfirm/documents/documents.module.js";
import { BillingModule } from "@app/lawfirm/billing/billing.module.js";
import { CalendarModule } from "@app/lawfirm/calendar/calendar.module.js";
import { DashboardModule } from "@app/lawfirm/dashboard/dashboard.module.js";
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

/**
 * Mizan Copilot (mizan/backend/app/lawfirm/assistant) — the AI orchestration
 * layer. It composes the existing law-firm feature modules so its tools can call
 * their services directly (the same path a screen uses), and reaches Core only
 * through the standard provider tokens (`PERMISSION_PROVIDER`,
 * `ORGANIZATION_PROVIDER`, `AUDIT_LOGGER`). Nothing here is promoted to Core.
 *
 * See docs/assistant.md.
 */
@Module({
  imports: [
    LawfirmSharedModule,
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
    { provide: ASSISTANT_CONFIG, useFactory: () => readAssistantConfig() },
    { provide: AI_CLIENT, useClass: OpenAiCompatibleClient },
    ReadTools,
    WriteTools,
    ToolRegistry,
    ScopeGuard,
    ConversationRepository,
    AssistantService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
