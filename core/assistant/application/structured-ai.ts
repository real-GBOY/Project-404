import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import { AppError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AI_CLIENT, ASSISTANT_CONFIG } from "@core/kernel/tokens.js";
import { type AiClient, AiUpstreamError } from "@core/assistant/domain/ai-client.js";
import type { AssistantConfig } from "@core/assistant/domain/assistant-config.js";

const log = moduleLogger("structured-ai");

/**
 * A single-shot, structured-JSON completion over Core's `AiClient` — the same provider
 * boundary the tool-calling assistant loop uses (`AI_CLIENT`), just without that loop: a
 * text-in / validated-JSON-out transform, never multi-turn, and never given a tool that
 * could reach the database. Extraction, classification, summarisation into a schema.
 *
 * Core owns the MECHANISM, an application owns the MEANING. The application supplies the
 * prompts and the Zod schema (what the fields are, what they may contain); this class:
 *  1. asks the provider for a JSON object (`jsonMode` — a well-formed reply is guaranteed
 *     by the provider, not merely requested in the prompt),
 *  2. extracts the outermost `{…}` span (models occasionally add fences or a stray sentence),
 *  3. validates it against the schema — the model's output is UNTRUSTED input,
 *  4. on a parse/validation failure, shows the model its own error and retries ONCE,
 *  5. then gives up with a clean `AppError` carrying the caller's `failureCode`.
 *
 * Provider trouble (`AiUpstreamError`: not configured / rate-limited / unavailable / timeout)
 * is rethrown untouched and NOT retried here — deciding whether and when to retry that is
 * the caller's (or the outbox's) job.
 */
@Injectable()
export class StructuredAi {
  constructor(
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Runs `systemPrompt` + `userPrompt` through the model and validates the
   * reply against `schema`. Throws `AiUpstreamError` variants unchanged
   * (misconfigured/rate-limited/unavailable/timeout — the caller already
   * knows how to render those); throws a fresh `AppError` only when the model
   * responded but never produced valid JSON, even after one retry.
   */
  async completeJson<S extends z.ZodTypeAny>(opts: {
    systemPrompt: string;
    userPrompt: string;
    schema: S;
    /** Machine code for the "gave up after retry" error. */
    failureCode: string;
    /** Output cap for this call (defaults to the configured one) — long analyses need headroom. */
    maxOutputTokens?: number;
  }): Promise<z.infer<S>> {
    if (!this.config.enabled) throw AiUpstreamError.misconfigured();

    const messages = [
      { role: "system" as const, content: opts.systemPrompt },
      { role: "user" as const, content: opts.userPrompt },
    ];

    // JSON mode: the provider guarantees well-formed JSON (the model otherwise leaves quotes unescaped
    // when it quotes someone's words). Zod still validates the SHAPE below.
    const call = { tools: [], jsonMode: true, ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}) };
    const first = await this.ai.createChatCompletion({ messages, ...call });
    const firstResult = tryParse(first.content, opts.schema);
    if (firstResult.ok) return firstResult.value;

    log.warn({ error: firstResult.error }, "structured-ai: model reply failed JSON/schema validation, retrying once");

    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: first.content },
      {
        role: "user" as const,
        content:
          `That wasn't valid — ${firstResult.error}. Reply again with ONLY the corrected JSON object, ` +
          "no prose, no markdown code fences.",
      },
    ];
    const second = await this.ai.createChatCompletion({ messages: retryMessages, ...call });
    const secondResult = tryParse(second.content, opts.schema);
    if (secondResult.ok) return secondResult.value;

    log.warn({ error: secondResult.error }, "structured-ai: model reply failed validation twice, giving up");
    throw new AppError({
      code: opts.failureCode,
      message: "The assistant couldn't produce a usable answer for this. Try rephrasing.",
      kind: "internal",
      cause: secondResult.error,
    });
  }
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function tryParse<S extends z.ZodTypeAny>(raw: string, schema: S): ParseResult<z.infer<S>> {
  const jsonText = extractJsonObject(raw);
  if (jsonText === null) return { ok: false, error: "no JSON object found in the reply" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { ok: false, error: `invalid JSON (${err instanceof Error ? err.message : "parse error"})` };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: result.data };
}

/** Models occasionally wrap JSON in ```json fences or add a stray sentence —
 *  take the outermost {...} span rather than demanding a perfectly bare reply. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}
