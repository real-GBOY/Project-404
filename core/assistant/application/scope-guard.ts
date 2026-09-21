import { Inject, Injectable } from "@nestjs/common";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AI_CLIENT, ASSISTANT_CONFIG, SCOPE_GUARD_CONFIG } from "@core/kernel/tokens.js";
import type { AiClient } from "@core/assistant/domain/ai-client.js";
import type { AssistantConfig } from "@core/assistant/domain/assistant-config.js";
import type { ScopeGuardConfig } from "@core/assistant/domain/scope-guard-config.js";

const log = moduleLogger("assistant-scope");

export interface ScopeDecision {
  inScope: boolean;
  /** How the decision was reached — for logging only. */
  via:
    "disabled" | "in_heuristic" | "out_heuristic" | "followup" | "classifier" | "classifier_error";
}

/**
 * Generic scope-gate engine. The heuristic and
 * classifier vocabulary is entirely product-supplied via `SCOPE_GUARD_CONFIG`
 * — this class owns only the decision order, not the domain content:
 *
 *   cheap allow heuristics → cheap deny heuristic → short follow-ups (with
 *   history) → one minimal classifier call.
 *
 * Fails **open** (allows) on a classifier error — the system prompt is the
 * backstop.
 */
@Injectable()
export class ScopeGuard {
  constructor(
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
    @Inject(SCOPE_GUARD_CONFIG) private readonly vocabulary: ScopeGuardConfig,
  ) {}

  async check(message: string, hasHistory: boolean): Promise<ScopeDecision> {
    if (this.config.scopeEnforcement !== "strict") return { inScope: true, via: "disabled" };

    const m = message.trim();
    const { inScopePatterns, metaPatterns, outOfScopePatterns } = this.vocabulary;

    if ([...inScopePatterns, ...metaPatterns].some((re) => re.test(m))) {
      return { inScope: true, via: "in_heuristic" };
    }
    if (outOfScopePatterns.some((re) => re.test(m))) {
      return { inScope: false, via: "out_heuristic" };
    }
    // "yes", "the second one", "and last month?" — a terse reply only makes
    // sense as a follow-up to an in-scope thread, which the guard already vetted.
    if (hasHistory && m.split(/\s+/).length <= 7) {
      return { inScope: true, via: "followup" };
    }

    try {
      const resp = await this.ai.createChatCompletion({
        messages: [
          { role: "system", content: this.vocabulary.classifierPrompt },
          { role: "user", content: m.slice(0, 600) },
        ],
        tools: [],
      });
      const inScope = /\bIN_SCOPE\b/i.test(resp.content) && !/\bOUT_OF_SCOPE\b/i.test(resp.content);
      return { inScope, via: "classifier" };
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "scope classifier failed — allowing",
      );
      return { inScope: true, via: "classifier_error" };
    }
  }

  outOfScopeReply(locale: string): string {
    return this.vocabulary.outOfScopeReply(locale);
  }
}
