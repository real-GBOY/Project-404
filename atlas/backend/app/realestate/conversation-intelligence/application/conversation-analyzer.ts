import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AUDIT_LOGGER, CLOCK, MESSAGING_PROVIDER, REALTIME_BROADCASTER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IMessagingProvider, IRealtimeBroadcaster } from "@core/contracts/index.js";
import { realtimeRooms } from "@core/index.js";
import { LeadsRepository } from "@atlas/realestate/crm/infrastructure/leads-repository.js";
import { StructuredAi } from "@atlas/realestate/lead-intelligence/application/structured-ai.js";
import { ATLAS_CONVERSATION_AI_UPDATED, type ConversationAiUpdatedPayload } from "../contracts/insights-types.js";
import { analysisResponseSchema } from "../domain/analysis.schema.js";
import { type AiStateRow, ConversationAiStateRepository } from "../infrastructure/ai-state-repository.js";
import { ConversationAnalysisRequester } from "./analysis-requester.js";
import { toInsightsDto } from "./insights-reader.js";
import { buildAnalysisPrompt, MAX_MESSAGES_PER_STEP, type PreviousAnalysis } from "./prompts.js";

const log = moduleLogger("conversation-analyzer");

/** A `running` lock older than this is presumed to belong to a crashed worker. */
const STALE_LOCK_MS = 5 * 60 * 1000;
/** Steps per run. A longer backlog continues in a follow-up run rather than hogging a worker. */
const MAX_STEPS_PER_RUN = 5;

export type AnalysisOutcome =
  | { outcome: "analyzed"; version: number }
  | { outcome: "nothing_new"; version: number }
  | { outcome: "skipped"; reason: "already_running" | "ai_not_configured" }
  | { outcome: "failed"; code: string };

/**
 * Incremental conversation analysis:
 *
 *     previous analysis  +  only the NEW messages  =  updated analysis
 *
 * Runs from an outbox handler — NEVER in a request path — so a message is
 * already persisted, acked and broadcast before any LLM is involved.
 *
 *  - Data access is Core's messaging contract (`changesForAnalysis`), not SQL on
 *    `messaging_*`. It runs in the tenant's context (RLS on) with no user; the
 *    result is only ever surfaced through membership-checked endpoints.
 *  - The model has no tools and no database: text in, schema-validated JSON out
 *    (`StructuredAi`, the same provider boundary the Copilot uses).
 *  - Single-flight: an atomic DB claim; events that arrive mid-run are absorbed by
 *    the running job's loop, and a final re-check after releasing the lock
 *    closes the race where one lands just as it finishes.
 *  - Each LLM call happens OUTSIDE any transaction; each state write is its own
 *    short transaction.
 */
@Injectable()
export class ConversationAnalyzer {
  constructor(
    private readonly state: ConversationAiStateRepository,
    private readonly requester: ConversationAnalysisRequester,
    private readonly ai: StructuredAi,
    private readonly leads: LeadsRepository,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: IMessagingProvider,
    @Inject(REALTIME_BROADCASTER) private readonly realtime: IRealtimeBroadcaster,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async run(conversationId: string): Promise<AnalysisOutcome> {
    if (!this.ai.enabled) return { outcome: "skipped", reason: "ai_not_configured" };

    const claimed = await this.claim(conversationId);
    if (!claimed) return { outcome: "skipped", reason: "already_running" };

    let holding = true;
    let analyzed = false;
    let lastChangeSeq = 0;
    try {
      this.broadcast(conversationId, claimed, lastChangeSeq);

      for (let step = 0; step < MAX_STEPS_PER_RUN; step++) {
        const prev = (await readInTenant(() => this.state.find(conversationId)))!;
        const batch = await this.messaging.changesForAnalysis(conversationId, prev.lastAnalyzedChangeSeq, MAX_MESSAGES_PER_STEP);
        lastChangeSeq = batch.conversation.lastChangeSeq;

        if (batch.messages.length === 0) {
          // Nothing left. Release, then look once more: an event that found us
          // "running" was absorbed by this loop, but a message committed after our
          // last read and before this release would otherwise be stranded.
          await this.release(conversationId);
          holding = false;
          const peek = await this.messaging.changesForAnalysis(conversationId, prev.lastAnalyzedChangeSeq, 1);
          if (peek.messages.length === 0) break;
          if (!(await this.claim(conversationId))) break; // another worker took it — it will finish the job
          holding = true;
          continue;
        }

        // What in this batch is genuinely NEW (or edited/deleted) rather than a reaction-only touch?
        const relevant = batch.messages.filter((m) => m.seq > prev.lastAnalyzedSeq || m.editedAt !== null || m.deletedAt !== null);
        const cursors = {
          changeSeq: Math.max(...batch.messages.map((m) => m.changeSeq)),
          seq: Math.max(prev.lastAnalyzedSeq, ...batch.messages.map((m) => m.seq)),
        };
        if (relevant.length === 0) {
          await this.uow.transaction(() => this.state.advanceCursor(conversationId, cursors));
          continue;
        }

        const names = new Map(batch.conversation.members.map((m) => [m.userId, m.displayName]));
        const { systemPrompt, userPrompt } = buildAnalysisPrompt({
          previous: previousOf(prev),
          messages: relevant,
          names,
          subjectLine: await this.subjectLine(batch.conversation.subjectType, batch.conversation.subjectId),
        });

        // ── the only LLM call, outside every transaction ──
        const result = await this.ai.completeJson({
          systemPrompt,
          userPrompt,
          schema: analysisResponseSchema,
          failureCode: "conversation_intelligence.analysis_failed",
        });

        const saved = await this.uow.transaction(async () => {
          const row = await this.state.save(conversationId, {
            summary: result.summary,
            keyFacts: result.keyFacts,
            actionItems: result.actionItems,
            unresolvedQuestions: result.unresolvedQuestions,
            extractedRequirements: result.requirements,
            lastAnalyzedChangeSeq: cursors.changeSeq,
            lastAnalyzedSeq: cursors.seq,
            at: this.clock.now(),
          });
          await this.audit.record({
            actorId: null,
            actorType: "system",
            action: "realestate.conversation.ai_analyzed",
            resourceType: "messaging_conversation",
            resourceId: conversationId,
            // Shape only — never message text.
            after: { version: row.version, messagesAnalyzed: relevant.length },
          });
          return row;
        });
        analyzed = true;
        this.broadcast(conversationId, saved, lastChangeSeq);
      }

      if (holding) {
        // Step budget spent. Release, and if more is waiting, continue in a fresh run.
        const final = await this.release(conversationId);
        holding = false;
        const more = await this.messaging.changesForAnalysis(conversationId, final.lastAnalyzedChangeSeq, 1);
        if (more.messages.length > 0) await this.requester.request(conversationId, "continuation");
      }

      const done = (await readInTenant(() => this.state.find(conversationId)))!;
      this.broadcast(conversationId, done, lastChangeSeq);
      return analyzed ? { outcome: "analyzed", version: done.version } : { outcome: "nothing_new", version: done.version };
    } catch (err) {
      return await this.fail(conversationId, err, holding, lastChangeSeq);
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private claim(conversationId: string): Promise<AiStateRow | null> {
    return this.uow.transaction(() => this.state.claim(conversationId, this.clock.now(), STALE_LOCK_MS));
  }

  private release(conversationId: string): Promise<AiStateRow> {
    return this.uow.transaction(() => this.state.finish(conversationId, { status: "idle" }));
  }

  /**
   * Transient upstream trouble (rate limit / timeout / provider down) is rethrown
   * so the OUTBOX retries with backoff; a model that answered but never produced
   * valid output is recorded and NOT retried (a retry would just spend tokens).
   * Either way the stored analysis is untouched and the lock is released.
   */
  private async fail(
    conversationId: string,
    err: unknown,
    holding: boolean,
    lastChangeSeq: number,
  ): Promise<AnalysisOutcome> {
    const code = err instanceof AppError ? err.code : "internal";
    log.warn({ conversationId, code }, "conversation analysis failed");
    if (holding) {
      const row = await this.uow.transaction(() => this.state.finish(conversationId, { status: "failed", error: code }));
      this.broadcast(conversationId, row, lastChangeSeq);
    }
    const transient = err instanceof AppError && err.code.startsWith("assistant.");
    if (transient || !(err instanceof AppError)) throw err;
    return { outcome: "failed", code };
  }

  private broadcast(conversationId: string, row: AiStateRow, lastChangeSeq: number): void {
    const payload: ConversationAiUpdatedPayload = {
      conversationId,
      insights: toInsightsDto(conversationId, row, lastChangeSeq),
    };
    // Only members are in this room (joined after a live membership check), so the
    // insights reach exactly the people who may read the conversation.
    this.realtime.toRoom(realtimeRooms.conversation(conversationId), ATLAS_CONVERSATION_AI_UPDATED, payload);
  }

  private async subjectLine(subjectType: string | null, subjectId: string | null): Promise<string | null> {
    if (subjectType !== "lead" || !subjectId) return null;
    const lead = await readInTenant(() => this.leads.findById(subjectId));
    return lead ? `This conversation is about the lead "${lead.name}".` : null;
  }
}

function previousOf(row: AiStateRow): PreviousAnalysis | null {
  if (row.version === 0) return null;
  return {
    summary: row.summary,
    keyFacts: row.keyFacts,
    actionItems: row.actionItems,
    unresolvedQuestions: row.unresolvedQuestions,
    requirements: row.extractedRequirements,
  };
}

