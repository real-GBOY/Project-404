import type { ToolContext } from "@core/assistant/domain/tool.js";

/** Everything the system prompt needs beyond the caller's own tool context. */
export interface SystemPromptContext extends ToolContext {
  now: Date;
  organizationName: string;
  userName: string;
}

/**
 * The one piece of product identity the generic orchestration loop needs: what
 * to tell the model, and how to namespace its own audit trail. Bound per
 * product via the `ASSISTANT_DOMAIN_CONFIG` token — Core never sees the prompt
 * text itself, only calls through to build it.
 */
export interface AssistantDomainConfig {
  /**
   * Short slug identifying the product, used only to namespace audit actions
   * (`"lawfirm"` → `lawfirm.assistant.query` / `lawfirm_ai_conversation`).
   * Carries no other meaning to Core.
   */
  domainKey: string;
  buildSystemPrompt(ctx: SystemPromptContext): string;
}
