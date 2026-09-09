import { z } from "zod";

/**
 * Mizan Copilot configuration — **Mizan-owned, not AURIC Core** (the Core config
 * in `core/kernel/config.ts` must stay domain-agnostic). Parsed once from the
 * environment; a bad config fails fast at boot rather than at the first chat.
 *
 * The provider/model are swappable on purpose (see docs/assistant.md): the
 * orchestration layer, tools, and RBAC are provider-independent, so pointing at
 * a different OpenAI-compatible backend is a config change, not a code change.
 *
 *   AI_PROVIDER=groq
 *   AI_MODEL=openai/gpt-oss-120b
 *   AI_BASE_URL=https://api.groq.com/openai/v1
 *   GROQ_API_KEY=...            # or OPENAI_API_KEY when AI_PROVIDER=openai
 */
export const ASSISTANT_CONFIG = Symbol("mizan.assistant.config");

const schema = z.object({
  provider: z.enum(["groq", "openai"]).default("groq"),
  model: z.string().min(1).default("openai/gpt-oss-120b"),
  baseUrl: z.string().url().default("https://api.groq.com/openai/v1"),
  apiKey: z.string().default(""),
  /** Per upstream HTTP call, milliseconds. */
  requestTimeoutMs: z.coerce.number().int().positive().default(45_000),
  /** Hard cap on agent-loop iterations (tool round-trips) before we stop. */
  maxToolIterations: z.coerce.number().int().positive().max(20).default(6),
  /** Conversation turns sent upstream before the oldest are dropped. */
  maxHistoryMessages: z.coerce.number().int().positive().default(24),
  /** Upper bound on assistant output tokens per turn. */
  maxOutputTokens: z.coerce.number().int().positive().default(1500),
  /**
   * Keeps the assistant on-topic (Mizan / the firm's practice-management data).
   *   strict      — a pre-flight scope check refuses off-topic requests outright
   *   prompt_only — no pre-check; the system prompt is the only guard
   *   off         — no scope restriction
   */
  scopeEnforcement: z.enum(["strict", "prompt_only", "off"]).default("strict"),
});

export type AssistantConfig = z.infer<typeof schema> & { enabled: boolean };

export function readAssistantConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfig {
  const provider = (env.AI_PROVIDER ?? "groq").toLowerCase();
  const apiKey =
    env.AI_API_KEY ?? (provider === "openai" ? env.OPENAI_API_KEY : env.GROQ_API_KEY) ?? "";

  const parsed = schema.safeParse({
    provider,
    model: env.AI_MODEL,
    baseUrl: env.AI_BASE_URL ?? (provider === "openai" ? "https://api.openai.com/v1" : undefined),
    apiKey,
    requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    maxToolIterations: env.AI_MAX_TOOL_ITERATIONS,
    maxHistoryMessages: env.AI_MAX_HISTORY_MESSAGES,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    scopeEnforcement: env.AI_SCOPE_ENFORCEMENT,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid AI / Mizan Copilot configuration:\n${issues}`);
  }

  // No key → the module still loads (so the rest of the app boots and tests that
  // stub the client run), but a real chat request is refused with a clear error.
  return { ...parsed.data, enabled: parsed.data.apiKey.length > 0 };
}
