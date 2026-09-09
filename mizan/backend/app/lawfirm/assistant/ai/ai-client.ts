import { AppError } from "@core/kernel/errors.js";

/**
 * The provider boundary. Everything above this (orchestration, tools, RBAC,
 * persistence) is provider-independent; everything below is one vendor's wire
 * format. v1 ships one implementation — an OpenAI-compatible **Chat Completions**
 * client (Groq's `openai/gpt-oss-120b`, or api.openai.com). A future Responses
 * API provider implements the same interface without touching the caller.
 */

export interface AiToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    /** JSON Schema object. */
    parameters: Record<string, unknown>;
  };
}

export interface AiToolCall {
  id: string;
  name: string;
  /** Raw JSON string as emitted by the model — parsed/validated by the registry. */
  arguments: string;
}

export type AiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface AiChatRequest {
  messages: AiMessage[];
  tools: AiToolDef[];
  /** Signal from the caller (request abort / shutdown). */
  signal?: AbortSignal;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiChatResponse {
  /** Assistant free text (may be empty when only tool calls were returned). */
  content: string;
  toolCalls: AiToolCall[];
  finishReason: string;
  usage: AiUsage;
}

export const AI_CLIENT = Symbol("mizan.assistant.aiClient");

export interface AiClient {
  createChatCompletion(req: AiChatRequest): Promise<AiChatResponse>;
}

/** Upstream failure taxonomy — mapped to safe, user-facing `AppError`s. */
export const AiUpstreamError = {
  rateLimited: (cause?: unknown) =>
    new AppError({
      code: "assistant.rate_limited",
      message: "The assistant is busy right now. Try again in a moment.",
      kind: "rate_limited",
      cause,
    }),
  timeout: (cause?: unknown) =>
    new AppError({
      code: "assistant.timeout",
      message: "The assistant took too long to respond. Please try again.",
      kind: "internal",
      cause,
    }),
  unavailable: (cause?: unknown) =>
    new AppError({
      code: "assistant.upstream_unavailable",
      message: "The assistant is temporarily unavailable. Please try again.",
      kind: "internal",
      cause,
    }),
  misconfigured: () =>
    new AppError({
      code: "assistant.not_configured",
      message: "The assistant is not configured on this server.",
      kind: "internal",
    }),
};
