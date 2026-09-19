import type { Clock } from "@core/kernel/clock.js";
import type { EventRegistry } from "@core/events/registry.js";
import {
  type MessageCreatedEvent,
  type MessageDeletedEvent,
  type MessageUpdatedEvent,
  MessagingDomainEvents,
} from "@core/index.js";
import type { ConversationAnalysisRequester } from "../application/analysis-requester.js";
import type { ConversationAnalyzer } from "../application/conversation-analyzer.js";
import { AUTO_ANALYZED_SUBJECTS } from "../domain/analysis.schema.js";
import type { ConversationAiStateRepository } from "../infrastructure/ai-state-repository.js";
import { AtlasConversationEvents, type AnalysisRequestedEvent } from "./events.js";

/**
 * Wires Core messaging into Atlas's analysis, in two deliberate hops:
 *
 *  1. IN-PROCESS on `messaging.message.*` — runs inside the sender's transaction
 *     but only does one thing: if the conversation is worth analysing, write an
 *     `atlas.conversation.analysis_requested` outbox row. Pure DB, no LLM, so it
 *     cannot slow or fail a send.
 *  2. EXTERNAL on that request — the outbox worker runs the analyzer after COMMIT,
 *     with its own retries/backoff/DLQ, isolated from Core's realtime-broadcast
 *     row (an LLM outage never re-broadcasts a message).
 */
/** A queued marker older than this is presumed orphaned (request dead-lettered / worker crashed). */
const QUEUE_STALE_MS = 5 * 60 * 1000;

export function registerConversationIntelligenceSubscribers(
  registry: EventRegistry,
  deps: {
    state: ConversationAiStateRepository;
    requester: ConversationAnalysisRequester;
    analyzer: ConversationAnalyzer;
    clock: Clock;
  },
): void {
  const onMessage = async (event: { payload: Record<string, unknown> }): Promise<void> => {
    const p = event.payload as MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent;
    const auto = p.subjectType !== null && AUTO_ANALYZED_SUBJECTS.includes(p.subjectType);
    // A conversation someone explicitly asked to analyse stays analysed.
    if (!auto && !(await deps.state.exists(p.conversationId))) return;
    // Coalesce: a burst of N messages queues ONE request, not N (each would call the LLM).
    if (await deps.state.markQueued(p.conversationId, deps.clock.now(), QUEUE_STALE_MS)) {
      await deps.requester.publish(p.conversationId, "message");
    }
  };

  registry.onInProcess(MessagingDomainEvents.MessageCreated, onMessage);
  registry.onInProcess(MessagingDomainEvents.MessageUpdated, onMessage);
  registry.onInProcess(MessagingDomainEvents.MessageDeleted, onMessage);

  registry.onExternal(
    AtlasConversationEvents.AnalysisRequested,
    "atlas.conversation_intelligence.analyze",
    async (event) => {
      const p = event.payload as AnalysisRequestedEvent;
      await deps.analyzer.run(p.conversationId);
    },
  );
}
