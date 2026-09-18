/**
 * Atlas conversation-insight wire types — REST responses and the
 * `atlas:conversation:ai_updated` realtime payload, shared (type-only) with
 * atlas/web. No imports, no runtime code besides the event-name constant.
 *
 * Deliberately Atlas-specific: this is what a conversation MEANS to a real-estate
 * business (requirements, action items, open questions). Core messaging has no
 * notion of any of it.
 */

/** Emitted to the conversation's authorized room when an analysis run changes the insights. */
export const ATLAS_CONVERSATION_AI_UPDATED = "atlas:conversation:ai_updated" as const;

export type InsightStatus = "none" | "idle" | "running" | "failed";
export type ActionOwner = "agent" | "customer" | "unknown";

/** Mirrors the lead-intelligence `LeadRequirements` (asserted at compile time in the analyzer). */
export interface InsightRequirements {
  budgetMinEgp: number | null;
  budgetMaxEgp: number | null;
  locations: string[];
  propertyTypes: string[];
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  preferredFloors: number[];
  deliveryWithinMonths: number | null;
  otherPreferences: string[];
  intent: "high" | "medium" | "low" | "unknown";
  summary: string;
}

export interface InsightKeyFact {
  label: string;
  value: string;
}

export interface InsightActionItem {
  action: string;
  owner: ActionOwner;
  /** As said in the conversation ("tonight", "Sunday") — never a resolved date. */
  due: string | null;
}

export interface ConversationInsightsDto {
  conversationId: string;
  status: InsightStatus;
  /** 0 = never analysed. Bumped by every successful run. */
  version: number;
  summary: string;
  keyFacts: InsightKeyFact[];
  actionItems: InsightActionItem[];
  unresolvedQuestions: string[];
  requirements: InsightRequirements | null;
  analyzedAt: string | null;
  /** True when the conversation has changes the analysis has not folded in yet. */
  stale: boolean;
  lastError: string | null;
}

export interface ConversationAiUpdatedPayload {
  conversationId: string;
  insights: ConversationInsightsDto;
}
