import type {
  AiChatRequest,
  AiChatResponse,
  AiClient,
} from "@app/lawfirm/assistant/ai/ai-client.js";

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

/** Answer with the verbatim content of the most recent tool message — lets a
 *  test assert on exactly what a tool returned to the model. */
export const echoLastToolResult = (req: AiChatRequest): AiChatResponse => {
  const tool = [...req.messages].reverse().find((m) => m.role === "tool");
  return say(tool && "content" in tool ? tool.content : "(no tool result)");
};

/**
 * A deterministic `AiClient` for tests. Feed it a queue of turns (or turn
 * factories); it hands them out in order and records every request it saw.
 */
export class ScriptedAiClient implements AiClient {
  readonly requests: AiChatRequest[] = [];
  private queue: Turn[] = [];
  private thrower: (() => Error) | null = null;

  script(...turns: Turn[]): this {
    this.queue = turns;
    this.thrower = null;
    return this;
  }

  fail(makeError: () => Error): this {
    this.thrower = makeError;
    return this;
  }

  async createChatCompletion(req: AiChatRequest): Promise<AiChatResponse> {
    this.requests.push(req);
    if (this.thrower) throw this.thrower();
    const turn = this.queue.shift();
    if (!turn) return say("(script exhausted)");
    return typeof turn === "function" ? turn(req, this.requests.length - 1) : turn;
  }
}
