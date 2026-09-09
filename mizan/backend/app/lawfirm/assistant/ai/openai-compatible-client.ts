import { Inject, Injectable } from "@nestjs/common";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { ASSISTANT_CONFIG, type AssistantConfig } from "../assistant-config.js";
import {
  AiUpstreamError,
  type AiChatRequest,
  type AiChatResponse,
  type AiClient,
  type AiMessage,
  type AiToolCall,
} from "./ai-client.js";

const log = moduleLogger("assistant-ai");

/** Wire shape of a Chat Completions `choices[].message`. */
interface WireMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface WireResponse {
  choices?: Array<{ message?: WireMessage; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; type?: string };
}

/**
 * OpenAI-compatible Chat Completions client (Groq / OpenAI). The only place in
 * the module that knows the vendor wire format. No SDK — a single `fetch` with
 * an abort-based timeout keeps the dependency surface at zero.
 */
@Injectable()
export class OpenAiCompatibleClient implements AiClient {
  constructor(@Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig) {}

  async createChatCompletion(req: AiChatRequest): Promise<AiChatResponse> {
    if (!this.config.enabled) throw AiUpstreamError.misconfigured();

    const body = {
      model: this.config.model,
      messages: req.messages.map(toWireMessage),
      ...(req.tools.length > 0 ? { tools: req.tools, tool_choice: "auto" } : {}),
      max_completion_tokens: this.config.maxOutputTokens,
      temperature: 0.2,
    };

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.requestTimeoutMs);
    const signal = req.signal ? anySignal([req.signal, timeout.signal]) : timeout.signal;

    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError" && timeout.signal.aborted) {
        throw AiUpstreamError.timeout(err);
      }
      throw AiUpstreamError.unavailable(err);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: WireResponse = {};
    try {
      json = text ? (JSON.parse(text) as WireResponse) : {};
    } catch {
      /* non-JSON error body */
    }

    if (!res.ok) {
      log.warn(
        { status: res.status, latencyMs: Date.now() - started, upstreamCode: json.error?.type },
        "assistant upstream call failed",
      );
      if (res.status === 429) throw AiUpstreamError.rateLimited(json.error?.message);
      throw AiUpstreamError.unavailable(json.error?.message ?? `HTTP ${res.status}`);
    }

    const choice = json.choices?.[0];
    const message = choice?.message;
    return {
      content: message?.content ?? "",
      toolCalls: (message?.tool_calls ?? []).map((tc): AiToolCall => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments || "{}",
      })),
      finishReason: choice?.finish_reason ?? "stop",
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
      },
    };
  }
}

function toWireMessage(m: AiMessage): Record<string, unknown> {
  switch (m.role) {
    case "assistant":
      return {
        role: "assistant",
        content: m.content ?? "",
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
              })),
            }
          : {}),
      };
    case "tool":
      return { role: "tool", tool_call_id: m.toolCallId, name: m.name, content: m.content };
    default:
      return { role: m.role, content: m.content };
  }
}

/** Combine abort signals without depending on `AbortSignal.any` availability. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}
