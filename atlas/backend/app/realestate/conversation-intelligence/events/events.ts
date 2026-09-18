import type { DomainEvent } from "@core/contracts/domain-event.js";

/**
 * Atlas-owned events (Core's `messaging.*` events are Core's). One outbox row per
 * request, so the analysis has its own retries/backoff/DLQ and a failing LLM call
 * can never cause Core's realtime broadcast row to be redelivered.
 */
export const AtlasConversationEvents = {
  AnalysisRequested: "atlas.conversation.analysis_requested",
} as const;

export type AnalysisRequestReason = "message" | "manual" | "assistant" | "continuation";

export type AnalysisRequestedEvent = {
  organizationId: string;
  conversationId: string;
  reason: AnalysisRequestReason;
};

export const analysisRequested = (p: AnalysisRequestedEvent): DomainEvent => ({
  name: AtlasConversationEvents.AnalysisRequested,
  version: 1,
  payload: p,
});
