import type { AuricConfig } from "@core/kernel/config.js";

/**
 * AI Copilot runtime configuration — provider/model/limits. Sourced from
 * `AuricConfig` (core/kernel/config.ts), not read from `process.env` directly
 * here, so it follows the same single-parse-at-boot discipline as the rest of
 * Core. See core/assistant/README.md.
 */
export interface AssistantConfig {
  provider: "groq" | "openai";
  model: string;
  baseUrl: string;
  apiKey: string;
  /** Per upstream HTTP call, milliseconds. */
  requestTimeoutMs: number;
  /** Hard cap on agent-loop iterations (tool round-trips) before we stop. */
  maxToolIterations: number;
  /** Conversation turns sent upstream before the oldest are dropped. */
  maxHistoryMessages: number;
  /** Upper bound on assistant output tokens per turn. */
  maxOutputTokens: number;
  scopeEnforcement: "strict" | "prompt_only" | "off";
  /** `false` when no API key is configured — chat requests fail fast and clean. */
  enabled: boolean;
}

export function assistantConfigFromAuricConfig(cfg: AuricConfig): AssistantConfig {
  return {
    provider: cfg.aiProvider,
    model: cfg.aiModel,
    baseUrl: cfg.aiBaseUrl,
    apiKey: cfg.aiApiKey,
    requestTimeoutMs: cfg.aiRequestTimeoutMs,
    maxToolIterations: cfg.aiMaxToolIterations,
    maxHistoryMessages: cfg.aiMaxHistoryMessages,
    maxOutputTokens: cfg.aiMaxOutputTokens,
    scopeEnforcement: cfg.aiScopeEnforcement,
    enabled: cfg.aiApiKey.length > 0,
  };
}
