/**
 * `StructuredAi` — Core's single-shot, schema-validated JSON completion. Tested in isolation
 * (no database, no HTTP): only the provider boundary (`AiClient`) is faked. Nothing here knows
 * about any product — the schemas are throwaway shapes.
 */
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@core/kernel/errors.js";
import { AI_CLIENT, ASSISTANT_CONFIG } from "@core/kernel/tokens.js";
import {
  type AiChatRequest,
  type AiChatResponse,
  type AiClient,
  AiUpstreamError,
} from "@core/assistant/domain/ai-client.js";
import type { AssistantConfig } from "@core/assistant/domain/assistant-config.js";
import { StructuredAi } from "@core/assistant/application/structured-ai.js";

const reply = (content: string): AiChatResponse => ({ content, toolCalls: [], finishReason: "stop", usage: {} });

/** A recording `AiClient`: hands out queued replies (or throws) and remembers every request. */
class FakeAi implements AiClient {
  readonly requests: AiChatRequest[] = [];
  constructor(private readonly queue: Array<AiChatResponse | Error>) {}
  async createChatCompletion(req: AiChatRequest): Promise<AiChatResponse> {
    this.requests.push(req);
    const next = this.queue.shift();
    if (!next) throw new Error("FakeAi: script exhausted");
    if (next instanceof Error) throw next;
    return next;
  }
}

const config = (enabled = true): AssistantConfig => ({
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
});

const person = z.object({ name: z.string(), age: z.number() }).strict();
const make = (queue: Array<AiChatResponse | Error>, enabled = true) => {
  const ai = new FakeAi(queue);
  return { ai, structured: new StructuredAi(ai, config(enabled)) };
};
const call = <S extends z.ZodTypeAny>(structured: StructuredAi, schema: S, extra: { maxOutputTokens?: number } = {}) =>
  structured.completeJson({ systemPrompt: "SYS", userPrompt: "USR", schema, failureCode: "test.gave_up", ...extra });

describe("StructuredAi — valid structured output", () => {
  it("returns the parsed, schema-validated value from a clean JSON reply (one model call)", async () => {
    const { ai, structured } = make([reply('{"name":"Ahmed","age":30}')]);
    expect(await call(structured, person)).toEqual({ name: "Ahmed", age: 30 });
    expect(ai.requests).toHaveLength(1);
  });

  it("returns the schema's OUTPUT type: defaults and transforms are applied", async () => {
    const schema = z.object({ tags: z.array(z.string()).default([]), n: z.coerce.number() });
    const { structured } = make([reply('{"n":"7"}')]);
    expect(await call(structured, schema)).toEqual({ tags: [], n: 7 });
  });

  it("extracts the JSON object when the model wraps it in a markdown fence and prose", async () => {
    const { ai, structured } = make([reply('Sure! Here you go:\n```json\n{"name":"Sara","age":25}\n```\nHope that helps.')]);
    expect(await call(structured, person)).toEqual({ name: "Sara", age: 25 });
    expect(ai.requests).toHaveLength(1); // tolerated, not "repaired"
  });

  it("handles nested objects and arrays", async () => {
    const schema = z.object({ a: z.object({ b: z.array(z.object({ c: z.number() })) }) });
    const { structured } = make([reply('{"a":{"b":[{"c":1},{"c":2}]}}')]);
    expect(await call(structured, schema)).toEqual({ a: { b: [{ c: 1 }, { c: 2 }] } });
  });
});

describe("StructuredAi — what it asks the provider for", () => {
  it("sends system + user prompts, NO tools, and requests provider JSON mode", async () => {
    const { ai, structured } = make([reply('{"name":"A","age":1}')]);
    await call(structured, person);
    expect(ai.requests[0]).toEqual({
      messages: [
        { role: "system", content: "SYS" },
        { role: "user", content: "USR" },
      ],
      tools: [],
      jsonMode: true,
    });
  });

  it("passes a per-call output cap through, and omits it when not given", async () => {
    const withCap = make([reply('{"name":"A","age":1}')]);
    await call(withCap.structured, person, { maxOutputTokens: 4000 });
    expect(withCap.ai.requests[0]!.maxOutputTokens).toBe(4000);

    const without = make([reply('{"name":"A","age":1}')]);
    await call(without.structured, person);
    expect(without.ai.requests[0]).not.toHaveProperty("maxOutputTokens");
  });
});

describe("StructuredAi — validation failure and the repair retry", () => {
  it("repairs a SCHEMA violation: the model is shown its own reply and the reason, then succeeds", async () => {
    const { ai, structured } = make([reply('{"name":"Ahmed"}'), reply('{"name":"Ahmed","age":30}')]);
    expect(await call(structured, person)).toEqual({ name: "Ahmed", age: 30 });
    expect(ai.requests).toHaveLength(2);

    const repair = ai.requests[1]!.messages;
    expect(repair.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(repair[2]).toEqual({ role: "assistant", content: '{"name":"Ahmed"}' }); // its own bad reply
    expect(repair[3]!.content).toMatch(/age: Required/); // the actual zod complaint
    expect(repair[3]!.content).toMatch(/ONLY the corrected JSON object/);
    expect(ai.requests[1]!.jsonMode).toBe(true); // repair keeps the same constraints
    expect(ai.requests[1]!.tools).toEqual([]);
  });

  it("repairs syntactically INVALID JSON (the parse error is what the model is told)", async () => {
    const { ai, structured } = make([reply('{"name":"Ahmed","age":30,}'), reply('{"name":"Ahmed","age":30}')]);
    expect(await call(structured, person)).toEqual({ name: "Ahmed", age: 30 });
    expect(ai.requests[1]!.messages[3]!.content).toMatch(/invalid JSON/);
  });

  it("repairs a reply with no JSON object at all", async () => {
    const { ai, structured } = make([reply("I cannot do that."), reply('{"name":"A","age":1}')]);
    expect(await call(structured, person)).toEqual({ name: "A", age: 1 });
    expect(ai.requests[1]!.messages[3]!.content).toMatch(/no JSON object found/);
  });

  it("repairs a schema violation by an unknown key (strict schemas reject extras)", async () => {
    const { structured } = make([reply('{"name":"A","age":1,"deleteEverything":true}'), reply('{"name":"A","age":1}')]);
    expect(await call(structured, person)).toEqual({ name: "A", age: 1 });
  });

  it("makes at most ONE repair attempt — never a third call", async () => {
    const { ai, structured } = make([reply("nope"), reply("still nope"), reply('{"name":"A","age":1}')]);
    await expect(call(structured, person)).rejects.toThrow();
    expect(ai.requests).toHaveLength(2);
  });
});

describe("StructuredAi — failed repair", () => {
  it("gives up with a clean AppError carrying the CALLER's failure code (never the raw reply)", async () => {
    const { structured } = make([reply("no json here"), reply("still nothing")]);
    const err = await call(structured, person).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "test.gave_up", kind: "internal" });
    expect((err as AppError).message).toBe("The assistant couldn't produce a usable answer for this. Try rephrasing.");
    expect((err as AppError).message).not.toContain("still nothing");
  });

  it("keeps the last validation error as the (log-only) cause when the repair also violates the schema", async () => {
    const { structured } = make([reply('{"name":1,"age":"x"}'), reply('{"extra":true}')]);
    const err = (await call(structured, person).catch((e: unknown) => e)) as AppError;
    expect(err.code).toBe("test.gave_up");
    expect(String(err.cause)).toMatch(/Unrecognized key|Required/);
  });
});

describe("StructuredAi — provider failure", () => {
  it("rethrows an upstream error untouched and does NOT retry (retry policy belongs to the caller)", async () => {
    const { ai, structured } = make([AiUpstreamError.rateLimited()]);
    await expect(call(structured, person)).rejects.toMatchObject({ code: "assistant.rate_limited" });
    expect(ai.requests).toHaveLength(1);
  });

  it("passes every upstream variant through with its own code", async () => {
    for (const [make_, code] of [
      [AiUpstreamError.unavailable, "assistant.upstream_unavailable"],
      [AiUpstreamError.timeout, "assistant.timeout"],
    ] as const) {
      const { structured } = make([make_()]);
      await expect(call(structured, person)).rejects.toMatchObject({ code });
    }
  });

  it("a provider failure during the REPAIR call also propagates as-is (not swallowed into the failure code)", async () => {
    const { ai, structured } = make([reply("garbage"), AiUpstreamError.rateLimited()]);
    await expect(call(structured, person)).rejects.toMatchObject({ code: "assistant.rate_limited" });
    expect(ai.requests).toHaveLength(2);
  });

  it("refuses outright when the assistant is not configured — the model is never called", async () => {
    const { ai, structured } = make([], false);
    expect(structured.enabled).toBe(false);
    await expect(call(structured, person)).rejects.toMatchObject({ code: "assistant.not_configured" });
    expect(ai.requests).toHaveLength(0);
  });
});

describe("StructuredAi — wiring", () => {
  it("is injectable from Core's AI tokens alone (no product module needed)", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StructuredAi,
        { provide: AI_CLIENT, useValue: new FakeAi([reply('{"name":"DI","age":1}')]) },
        { provide: ASSISTANT_CONFIG, useValue: config() },
      ],
    }).compile();
    expect(await call(moduleRef.get(StructuredAi), person)).toEqual({ name: "DI", age: 1 });
  });
});
