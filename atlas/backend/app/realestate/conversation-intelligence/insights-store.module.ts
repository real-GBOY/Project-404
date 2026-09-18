import { Module } from "@nestjs/common";
import { EventsModule, MessagingModule } from "@core/index.js";
import { ConversationAnalysisRequester } from "./application/analysis-requester.js";
import { ConversationInsightsReader } from "./application/insights-reader.js";
import { ConversationAiStateRepository } from "./infrastructure/ai-state-repository.js";

/**
 * The AI-free half of conversation intelligence: the stored state, reading it
 * for a user, and asking for an analysis. It exists as its own leaf module so the
 * Copilot's conversation tools (in `AssistantModule`) and the analyzer (in
 * `ConversationIntelligenceModule`, which depends on `AssistantModule` for the AI
 * client) can share it without a module cycle.
 */
@Module({
  imports: [EventsModule, MessagingModule],
  providers: [ConversationAiStateRepository, ConversationAnalysisRequester, ConversationInsightsReader],
  exports: [ConversationAiStateRepository, ConversationAnalysisRequester, ConversationInsightsReader],
})
export class ConversationInsightsStoreModule {}
