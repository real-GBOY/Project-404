import type { AiChatRequest, AiChatResponse, AiClient } from "@core/assistant/domain/ai-client.js";

export type Turn = AiChatResponse | ((req: AiChatRequest, callIndex: number) => AiChatResponse);

export const say = (content: string): AiChatResponse => ({
  content,
  toolCalls: [],
  finishReason: "stop",
  usage: {},
});

export const callTool = (name: string, args: Record<string, unknown>): AiChatResponse => ({
  content: "",
  toolCalls: [{ id: `call_${name}`, name, arguments: JSON.stringify(args) }],
  finishReason: "tool_calls",
  usage: {},
});

/** A minimal scripted `AiClient` for Core-level assistant tests — no network. */
export class ScriptedAiClient implements AiClient {
  private turns: Turn[] = [];
  private callIndex = 0;
  readonly requests: AiChatRequest[] = [];

  script(...turns: Turn[]): void {
    this.turns = turns;
    this.callIndex = 0;
  }

  async createChatCompletion(req: AiChatRequest): Promise<AiChatResponse> {
    this.requests.push(req);
    const turn = this.turns[Math.min(this.callIndex, this.turns.length - 1)];
    this.callIndex++;
    if (!turn) return say("(no script)");
    return typeof turn === "function" ? turn(req, this.callIndex - 1) : turn;
  }
}
