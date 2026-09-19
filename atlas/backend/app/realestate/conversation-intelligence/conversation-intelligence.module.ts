import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { AuditModule, EventsModule, MessagingModule } from "@core/index.js";
import { EventRegistry } from "@core/events/registry.js";
import { CrmModule } from "@atlas/realestate/crm/crm.module.js";
import { AssistantModule } from "@atlas/realestate/assistant/assistant.module.js";
import { LeadIntelligenceModule } from "@atlas/realestate/lead-intelligence/lead-intelligence.module.js";
import { ConversationInsightsController } from "./api/insights.controller.js";
import { ConversationAnalysisRequester } from "./application/analysis-requester.js";
import { ConversationAnalyzer } from "./application/conversation-analyzer.js";
import { ConversationInsightsService } from "./application/insights-service.js";
import { registerConversationIntelligenceSubscribers } from "./events/subscribers.js";
import { ConversationAiStateRepository } from "./infrastructure/ai-state-repository.js";
import { ConversationInsightsStoreModule } from "./insights-store.module.js";

/**
 * Atlas Conversation Intelligence (docs/messaging.md §7) — what a Core messaging
 * conversation MEANS to a real-estate business. Consumes Core messaging through its
 * provider contract and events; reuses the Copilot's AI client boundary
 * (`StructuredAi`, via `LeadIntelligenceModule`) rather than standing up another.
 * Core knows nothing about any of this.
 */
@Module({
  imports: [
    EventsModule,
    AuditModule,
    MessagingModule,
    ConversationInsightsStoreModule,
    CrmModule,
    AssistantModule,
    LeadIntelligenceModule,
  ],
  controllers: [ConversationInsightsController],
  providers: [ConversationAnalyzer, ConversationInsightsService],
  exports: [ConversationAnalyzer, ConversationInsightsService],
})
export class ConversationIntelligenceModule implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    private readonly state: ConversationAiStateRepository,
    private readonly requester: ConversationAnalysisRequester,
    private readonly analyzer: ConversationAnalyzer,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    registerConversationIntelligenceSubscribers(this.registry, {
      state: this.state,
      requester: this.requester,
      analyzer: this.analyzer,
      clock: this.clock,
    });
  }
}
