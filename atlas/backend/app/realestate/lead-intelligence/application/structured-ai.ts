import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AppError } from "@core/kernel/errors.js";
import { AI_CLIENT, ASSISTANT_CONFIG } from "@core/kernel/tokens.js";
import type { AiClient, AssistantConfig } from "@core/index.js";
import { AiUpstreamError } from "@core/index.js";

const log = moduleLogger("lead-intelligence-ai");

/**
 * A single-shot, structured-JSON completion over Core's `AiClient` — the
 * same provider boundary the Atlas Copilot chat loop uses (`AI_CLIENT`), just
 * without the tool-calling agent loop: this module's two AI calls (extract
 * requirements, explain a match) are pure text-in/JSON-out transforms, never
 * multi-turn, and never given a tool that could touch the database.
 *
 * `AiClient.createChatCompletion` has no vendor-side "JSON mode" (see
 * `core/assistant/infrastructure/openai-compatible-client.ts` — a plain Chat
 * Completions request), so structure is enforced here, at the call site: ask
 * for JSON only in the prompt, then parse + Zod-validate the response, with
 * one repair retry (the model is shown its own parse/validation error and
 * asked to fix it) before giving up cleanly.
 *
 * Generic enough that a second product could reuse it verbatim; kept local
 * to Atlas for now since Atlas is the only caller — see
 * lead-intelligence/README (promote to `core/assistant` if that changes).
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
  }): Promise<z.infer<S>> {
    if (!this.config.enabled) throw AiUpstreamError.misconfigured();

    const messages = [
      { role: "system" as const, content: opts.systemPrompt },
      { role: "user" as const, content: opts.userPrompt },
    ];

    const first = await this.ai.createChatCompletion({ messages, tools: [] });
    const firstResult = tryParse(first.content, opts.schema);
    if (firstResult.ok) return firstResult.value;

    log.warn({ error: firstResult.error }, "lead-intelligence: model reply failed JSON/schema validation, retrying once");

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
    const second = await this.ai.createChatCompletion({ messages: retryMessages, tools: [] });
    const secondResult = tryParse(second.content, opts.schema);
    if (secondResult.ok) return secondResult.value;

    log.warn({ error: secondResult.error }, "lead-intelligence: model reply failed validation twice, giving up");
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
