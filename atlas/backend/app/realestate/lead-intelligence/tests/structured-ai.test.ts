/**
 * `StructuredAi` in isolation (no DB, no NestJS module boot) — the
 * JSON-extraction/retry/failure logic that `lead-intelligence-service.ts`
 * builds on. `lead-intelligence.integration.test.ts` covers the same
 * behaviour end to end; this file pins the parsing edge cases precisely.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { StructuredAi } from "../application/structured-ai.js";
import { ScriptedAiClient, say } from "@atlas/realestate/assistant/tests/scripted-ai-client.js";
import type { AssistantConfig } from "@core/index.js";

const schema = z.object({ name: z.string(), age: z.number() }).strict();

function makeAi(enabled = true): { ai: ScriptedAiClient; structured: StructuredAi } {
  const ai = new ScriptedAiClient();
  const config: AssistantConfig = {
    provider: "groq",
    model: "test-model",
    baseUrl: "http://unused",
    apiKey: enabled ? "test-key" : "",
    requestTimeoutMs: 1000,
    maxToolIterations: 1,
    maxHistoryMessages: 1,
    maxOutputTokens: 100,
    scopeEnforcement: "off",
    enabled,
  };
  return { ai, structured: new StructuredAi(ai, config) };
}

describe("lead-intelligence/application StructuredAi", () => {
  it("parses a clean JSON reply", async () => {
    const { ai, structured } = makeAi();
    ai.script(say(JSON.stringify({ name: "Ahmed", age: 30 })));
    const result = await structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.failed" });
    expect(result).toEqual({ name: "Ahmed", age: 30 });
  });

  it("extracts JSON even when the model wraps it in a markdown fence and prose", async () => {
    const { ai, structured } = makeAi();
    ai.script(say("Sure! Here you go:\n```json\n" + JSON.stringify({ name: "Sara", age: 25 }) + "\n```\nHope that helps."));
    const result = await structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.failed" });
    expect(result).toEqual({ name: "Sara", age: 25 });
  });

  it("retries once when the schema doesn't match, then succeeds", async () => {
    const { ai, structured } = makeAi();
    ai.script(say(JSON.stringify({ name: "Ahmed" })), say(JSON.stringify({ name: "Ahmed", age: 30 })));
    const result = await structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.failed" });
    expect(result).toEqual({ name: "Ahmed", age: 30 });
    expect(ai.requests.length).toBe(2);
  });

  it("throws a clean AppError, with the given code, after two invalid replies", async () => {
    const { ai, structured } = makeAi();
    ai.script(say("no json here"), say("still nothing"));
    await expect(structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.gave_up" })).rejects.toMatchObject({
      code: "test.gave_up",
    });
  });

  it("refuses outright when the assistant isn't configured — never calls the model", async () => {
    const { ai, structured } = makeAi(false);
    await expect(structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.failed" })).rejects.toMatchObject({
      code: "assistant.not_configured",
    });
    expect(ai.requests.length).toBe(0);
  });

  it("propagates an upstream provider failure (e.g. rate-limited) as-is, without retrying", async () => {
    const { ai, structured } = makeAi();
    const { AiUpstreamError } = await import("@core/index.js");
    ai.fail(() => AiUpstreamError.rateLimited());
    await expect(structured.completeJson({ systemPrompt: "s", userPrompt: "u", schema, failureCode: "test.failed" })).rejects.toMatchObject({
      code: "assistant.rate_limited",
    });
    expect(ai.requests.length).toBe(1);
  });
});
