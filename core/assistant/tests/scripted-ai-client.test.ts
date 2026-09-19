/**
 * The shared scripted `AiClient`. Every assistant test in the repo (Core's and each product's)
 * builds on it, so its contract is pinned here — a silent change would ripple everywhere.
 */
import { describe, expect, it } from "vitest";
import type { AiChatRequest } from "@core/assistant/domain/ai-client.js";
import { callTool, echoLastToolResult, say, ScriptedAiClient } from "./scripted-ai-client.js";

const req = (over: Partial<AiChatRequest> = {}): AiChatRequest => ({
  messages: [{ role: "user", content: "hi" }],
  tools: [],
  ...over,
});

describe("say / callTool", () => {
  it("say is a plain assistant answer with token usage", () => {
    expect(say("hello")).toEqual({
      content: "hello",
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it("callTool requests one tool call with JSON-encoded arguments and a default id derived from the name", () => {
    const r = callTool("get_thing", { id: 7 });
    expect(r.finishReason).toBe("tool_calls");
    expect(r.toolCalls).toEqual([{ id: "call_get_thing", name: "get_thing", arguments: '{"id":7}' }]);
  });

  it("callTool accepts any argument value and an explicit id", () => {
    expect(callTool("t", [1, 2], "call_x").toolCalls[0]).toEqual({ id: "call_x", name: "t", arguments: "[1,2]" });
    expect(callTool("t", null).toolCalls[0]!.arguments).toBe("null");
  });
});

describe("ScriptedAiClient", () => {
  it("hands out the scripted turns in order and records every request it saw", async () => {
    const ai = new ScriptedAiClient().script(say("one"), say("two"));
    const a = req({ messages: [{ role: "user", content: "first" }] });
    const b = req({ messages: [{ role: "user", content: "second" }] });
    expect((await ai.createChatCompletion(a)).content).toBe("one");
    expect((await ai.createChatCompletion(b)).content).toBe("two");
    expect(ai.requests).toEqual([a, b]);
  });

  it("once the script is empty it answers a visible '(script exhausted)' marker — it does NOT repeat the last turn", async () => {
    const ai = new ScriptedAiClient().script(say("only"));
    await ai.createChatCompletion(req());
    expect((await ai.createChatCompletion(req())).content).toBe("(script exhausted)");
    expect((await ai.createChatCompletion(req())).content).toBe("(script exhausted)");
  });

  it("an unscripted client is exhausted from the first call", async () => {
    expect((await new ScriptedAiClient().createChatCompletion(req())).content).toBe("(script exhausted)");
  });

  it("a turn can be a factory that sees the request and the call index", async () => {
    const seen: number[] = [];
    const ai = new ScriptedAiClient().script(
      (r, i) => (seen.push(i), say(`echo:${(r.messages[0] as { content: string }).content}`)),
      (_r, i) => (seen.push(i), say("second")),
    );
    expect((await ai.createChatCompletion(req({ messages: [{ role: "user", content: "x" }] }))).content).toBe("echo:x");
    await ai.createChatCompletion(req());
    expect(seen).toEqual([0, 1]);
  });

  it("script() and fail() are chainable", () => {
    const ai = new ScriptedAiClient();
    expect(ai.script(say("a"))).toBe(ai);
    expect(ai.fail(() => new Error("x"))).toBe(ai);
  });

  it("fail() makes every call throw (and still records the request); a fresh script() clears it", async () => {
    const ai = new ScriptedAiClient().fail(() => new Error("provider down"));
    await expect(ai.createChatCompletion(req())).rejects.toThrow("provider down");
    await expect(ai.createChatCompletion(req())).rejects.toThrow("provider down");
    expect(ai.requests).toHaveLength(2);

    ai.script(say("recovered"));
    expect((await ai.createChatCompletion(req())).content).toBe("recovered");
  });

  it("fail() takes a factory, so each call gets a FRESH error instance", async () => {
    const ai = new ScriptedAiClient().fail(() => new Error("boom"));
    const [a, b] = await Promise.all([ai.createChatCompletion(req()).catch((e: unknown) => e), ai.createChatCompletion(req()).catch((e: unknown) => e)]);
    expect(a).not.toBe(b);
  });

  it("the call index counts across the client's whole life — script() does not reset it", async () => {
    const seen: number[] = [];
    const ai = new ScriptedAiClient();
    ai.script((_r, i) => (seen.push(i), say("a")));
    await ai.createChatCompletion(req());
    ai.script((_r, i) => (seen.push(i), say("b")));
    await ai.createChatCompletion(req());
    expect(seen).toEqual([0, 1]);
  });
});

describe("echoLastToolResult", () => {
  it("answers with the verbatim content of the most recent tool message", () => {
    const r = echoLastToolResult({
      messages: [
        { role: "user", content: "q" },
        { role: "tool", toolCallId: "1", name: "a", content: "first result" },
        { role: "tool", toolCallId: "2", name: "b", content: "LATEST result" },
      ],
      tools: [],
    });
    expect(r.content).toBe("LATEST result");
  });

  it("says so when there was no tool result at all", () => {
    expect(echoLastToolResult(req()).content).toBe("(no tool result)");
  });
});
