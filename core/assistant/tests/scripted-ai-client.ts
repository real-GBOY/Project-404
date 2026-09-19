import type { AiChatRequest, AiChatResponse, AiClient } from "@core/assistant/domain/ai-client.js";

/**
 * The deterministic `AiClient` every assistant test in the repo uses — Core's own and each
 * product's. No network, no model: a test scripts exactly what the "model" says, and can
 * read back exactly what was sent to it.
 *
 * There is ONE implementation, here. Products re-export it from their own test folders so
 * existing imports keep working; they must not fork it (the copies had already started to
 * drift apart — different exhaustion behaviour, different usage numbers).
 */

export type Turn = AiChatResponse | ((req: AiChatRequest, callIndex: number) => AiChatResponse);

/** Assistant free-text answer. */
export const say = (content: string): AiChatResponse => ({
  content,
  toolCalls: [],
  finishReason: "stop",
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
});

/** Assistant requests one tool call. */
export const callTool = (name: string, args: unknown, id = `call_${name}`): AiChatResponse => ({
  content: "",
  toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
  finishReason: "tool_calls",
  usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
});

/**
 * Answer with the verbatim content of the most recent tool message — lets a test assert on
 * exactly what a tool returned to the model.
 */
export const echoLastToolResult = (req: AiChatRequest): AiChatResponse => {
  const tool = [...req.messages].reverse().find((m) => m.role === "tool");
  return say(tool && "content" in tool ? tool.content : "(no tool result)");
};

/**
 * Feed it a queue of turns (or turn factories); it hands them out in order and records every
 * request it saw. Once the queue is empty it answers "(script exhausted)" — a visible marker,
 * not a silent repeat, so a test that under-scripts its conversation fails loudly. `fail()`
 * makes every call throw instead (until the next `script()`).
 */
export class ScriptedAiClient implements AiClient {
  readonly requests: AiChatRequest[] = [];
  private queue: Turn[] = [];
  private thrower: (() => Error) | null = null;

  /** Replace the script (and clear any `fail()`). Chainable. */
  script(...turns: Turn[]): this {
    this.queue = turns;
    this.thrower = null;
    return this;
  }

  /** Every subsequent call throws `makeError()`. Chainable. */
  fail(makeError: () => Error): this {
    this.thrower = makeError;
    return this;
  }

  async createChatCompletion(req: AiChatRequest): Promise<AiChatResponse> {
    this.requests.push(req);
    if (this.thrower) throw this.thrower();
    const turn = this.queue.shift();
    if (!turn) return say("(script exhausted)");
    // `callIndex` counts calls over the client's whole life (it is not reset by `script()`).
    return typeof turn === "function" ? turn(req, this.requests.length - 1) : turn;
  }
}
