import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { MESSAGING_PROVIDER } from "@core/kernel/tokens.js";
import type { IMessagingProvider } from "@core/contracts/index.js";
import { leadRequirementsSchema } from "@atlas/realestate/lead-intelligence/domain/requirements.schema.js";
import type { ConversationInsightsDto, InsightRequirements } from "../contracts/insights-types.js";
import { type AiStateRow, ConversationAiStateRepository } from "../infrastructure/ai-state-repository.js";

/** Compile-time proof that the wire type and the lead-intelligence schema stay in step. */
type _RequirementsMatch = ReturnType<typeof leadRequirementsSchema.parse> extends InsightRequirements ? true : never;
const _requirementsMatch: _RequirementsMatch = true;
void _requirementsMatch;

/**
 * Reads a conversation's insights FOR A USER. Access is decided by Core
 * messaging: `getConversation` throws "not found" unless the actor is an active
 * member, so insights can never be read for a conversation the user cannot open.
 * (The stored analysis is derived from the whole conversation; membership is what
 * entitles someone to it.)
 */
@Injectable()
export class ConversationInsightsReader {
  constructor(
    private readonly state: ConversationAiStateRepository,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: IMessagingProvider,
  ) {}

  async get(actorId: string, conversationId: string): Promise<ConversationInsightsDto> {
    const conversation = await this.messaging.getConversation(actorId, conversationId);
    const row = await readInTenant(() => this.state.find(conversationId));
    return toInsightsDto(conversationId, row, conversation.lastChangeSeq);
  }
}

export function toInsightsDto(
  conversationId: string,
  row: AiStateRow | null,
  lastChangeSeq: number,
): ConversationInsightsDto {
  if (!row || row.version === 0) {
    return {
      conversationId,
      status: row?.status === "running" ? "running" : row?.status === "failed" ? "failed" : "none",
      version: 0,
      summary: "",
      keyFacts: [],
      actionItems: [],
      unresolvedQuestions: [],
      requirements: null,
      analyzedAt: null,
      stale: lastChangeSeq > 0,
      lastError: row?.lastError ?? null,
    };
  }
  const parsed = row.extractedRequirements ? leadRequirementsSchema.safeParse(row.extractedRequirements) : null;
  return {
    conversationId,
    status: row.status,
    version: row.version,
    summary: row.summary,
    keyFacts: row.keyFacts,
    actionItems: row.actionItems,
    unresolvedQuestions: row.unresolvedQuestions,
    requirements: parsed?.success ? parsed.data : null,
    analyzedAt: row.analyzedAt ? row.analyzedAt.toISOString() : null,
    stale: lastChangeSeq > row.lastAnalyzedChangeSeq,
    lastError: row.lastError,
  };
}
