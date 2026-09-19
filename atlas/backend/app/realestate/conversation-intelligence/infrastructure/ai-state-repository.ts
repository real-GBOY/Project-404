import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import type {
  ActionOwner,
  InsightActionItem,
  InsightKeyFact,
  InsightStatus,
} from "../contracts/insights-types.js";

export interface AiStateRow {
  conversationId: string;
  summary: string;
  keyFacts: InsightKeyFact[];
  actionItems: InsightActionItem[];
  unresolvedQuestions: string[];
  extractedRequirements: Record<string, unknown> | null;
  lastAnalyzedChangeSeq: number;
  lastAnalyzedSeq: number;
  version: number;
  status: Exclude<InsightStatus, "none">;
  runningAt: Date | null;
  lastError: string | null;
  analyzedAt: Date | null;
}

export interface SaveAnalysisInput {
  summary: string;
  keyFacts: InsightKeyFact[];
  actionItems: Array<{ action: string; owner: ActionOwner; due: string | null }>;
  unresolvedQuestions: string[];
  extractedRequirements: Record<string, unknown>;
  lastAnalyzedChangeSeq: number;
  lastAnalyzedSeq: number;
  at: Date;
}

/**
 * Persistence for `realestate_conversation_ai_state`. Everything here is
 * tenant-scoped by RLS (and explicitly by `organization_id`). The analysis is
 * single-flight through `claim`: an atomic UPDATE flips `idle|failed → running`
 * (or takes over a stale `running` row), so two workers can never analyse the
 * same conversation at once.
 */
@Injectable()
export class ConversationAiStateRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async find(conversationId: string): Promise<AiStateRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_conversation_ai_state")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .executeTakeFirst();
    return row ? toRow(row) : null;
  }

  async exists(conversationId: string): Promise<boolean> {
    const row = await realestateDb()
      .selectFrom("realestate_conversation_ai_state")
      .select("conversation_id")
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .executeTakeFirst();
    return row !== undefined;
  }

  /**
   * Try to become THE queued analysis request for this conversation. Returns true only when
   * the marker flipped (nothing was queued, or the marker was stale) — the caller enqueues
   * exactly then. Everything that arrives while a request is waiting is absorbed by it.
   */
  async markQueued(conversationId: string, now: Date, staleMs: number): Promise<boolean> {
    const staleBefore = new Date(now.getTime() - staleMs);
    const row = await realestateDb()
      .insertInto("realestate_conversation_ai_state")
      .values({ conversation_id: conversationId, organization_id: this.org(), queued_at: now })
      .onConflict((oc) =>
        oc
          .column("conversation_id")
          .doUpdateSet({ queued_at: now })
          .where((eb) =>
            eb.or([
              eb("realestate_conversation_ai_state.queued_at", "is", null),
              eb("realestate_conversation_ai_state.queued_at", "<", staleBefore),
            ]),
          ),
      )
      .returning("conversation_id")
      .executeTakeFirst();
    return row !== undefined;
  }

  /**
   * Atomically take the analysis lock. Returns the row (the claim does not touch
   * the analysis content, so it is the previous state), or `null` when someone
   * else holds a live lock.
   */
  async claim(conversationId: string, now: Date, staleMs: number): Promise<AiStateRow | null> {
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_conversation_ai_state")
      .values({ conversation_id: conversationId, organization_id: org })
      .onConflict((oc) => oc.column("conversation_id").doNothing())
      .execute();

    const staleBefore = new Date(now.getTime() - staleMs);
    const row = await realestateDb()
      .updateTable("realestate_conversation_ai_state")
      // Claiming consumes the queued request: messages arriving from now on queue a fresh one.
      .set({ status: "running", running_at: now, queued_at: null })
      .where("organization_id", "=", org)
      .where("conversation_id", "=", conversationId)
      .where((eb) =>
        eb.or([eb("status", "<>", "running"), eb("running_at", "<", staleBefore), eb("running_at", "is", null)]),
      )
      .returningAll()
      .executeTakeFirst();
    return row ? toRow(row) : null;
  }

  /** Fold a successful analysis step in; bumps `version`. Stays `running` (the run is not over). */
  async save(conversationId: string, input: SaveAnalysisInput): Promise<AiStateRow> {
    const row = await realestateDb()
      .updateTable("realestate_conversation_ai_state")
      .set({
        summary: input.summary,
        key_facts: JSON.stringify(input.keyFacts),
        action_items: JSON.stringify(input.actionItems),
        unresolved_questions: JSON.stringify(input.unresolvedQuestions),
        extracted_requirements: JSON.stringify(input.extractedRequirements),
        last_analyzed_change_seq: input.lastAnalyzedChangeSeq,
        last_analyzed_seq: input.lastAnalyzedSeq,
        version: sql<number>`version + 1`,
        analyzed_at: input.at,
        last_error: null,
      })
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRow(row);
  }

  /** Move the read cursors without re-analysing (a batch that contained nothing new, e.g. only reactions). */
  async advanceCursor(conversationId: string, cursors: { changeSeq: number; seq: number }): Promise<void> {
    await realestateDb()
      .updateTable("realestate_conversation_ai_state")
      .set({ last_analyzed_change_seq: cursors.changeSeq, last_analyzed_seq: cursors.seq })
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .execute();
  }

  /** Release the lock. */
  async finish(
    conversationId: string,
    outcome: { status: "idle" } | { status: "failed"; error: string },
  ): Promise<AiStateRow> {
    const row = await realestateDb()
      .updateTable("realestate_conversation_ai_state")
      .set({
        status: outcome.status,
        running_at: null,
        ...(outcome.status === "failed" ? { last_error: outcome.error.slice(0, 500) } : {}),
      })
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRow(row);
  }
}

function toRow(r: {
  conversation_id: string;
  summary: string;
  key_facts: InsightKeyFact[];
  action_items: InsightActionItem[];
  unresolved_questions: string[];
  extracted_requirements: Record<string, unknown> | null;
  last_analyzed_change_seq: number;
  last_analyzed_seq: number;
  version: number;
  status: "idle" | "running" | "failed";
  running_at: Date | null;
  last_error: string | null;
  analyzed_at: Date | null;
}): AiStateRow {
  return {
    conversationId: r.conversation_id,
    summary: r.summary,
    keyFacts: r.key_facts,
    actionItems: r.action_items,
    unresolvedQuestions: r.unresolved_questions,
    extractedRequirements: r.extracted_requirements,
    lastAnalyzedChangeSeq: r.last_analyzed_change_seq,
    lastAnalyzedSeq: r.last_analyzed_seq,
    version: r.version,
    status: r.status,
    runningAt: r.running_at,
    lastError: r.last_error,
    analyzedAt: r.analyzed_at,
  };
}
