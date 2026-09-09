import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { AppError } from "@core/kernel/errors.js";
import { getContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AUDIT_LOGGER, CLOCK, ORGANIZATION_PROVIDER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IOrganizationProvider } from "@core/contracts/index.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { AI_CLIENT, type AiClient, type AiMessage } from "./ai/ai-client.js";
import { ASSISTANT_CONFIG, type AssistantConfig } from "./assistant-config.js";
import {
  ConversationRepository,
  type MessageRow,
  type StoredToolCall,
} from "./conversation-repository.js";
import { guardResponse } from "./response-guard.js";
import { ScopeGuard, outOfScopeReply } from "./scope-guard.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { ToolRegistry } from "./tools/tool-registry.js";
import type { ToolContext } from "./tools/tool.js";

const log = moduleLogger("assistant");

export interface ChatInput {
  userId: string;
  organizationId: string | null;
  locale: string;
  conversationId?: string;
  message: string;
  currentContext?: { screen?: string; matterId?: string; clientId?: string };
  signal?: AbortSignal;
}

export interface ToolActivity {
  name: string;
  ok: boolean;
  mutates: boolean;
  error?: string;
}

export interface ChatResult {
  conversationId: string;
  message: string;
  toolActivity: ToolActivity[];
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/** Trim a tool result before it goes into the transcript / back upstream. */
const MAX_TOOL_RESULT_CHARS = 6000;

@Injectable()
export class AssistantService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly registry: ToolRegistry,
    private readonly scope: ScopeGuard,
    private readonly directory: LawfirmDirectory,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
    @Inject(ORGANIZATION_PROVIDER) private readonly orgs: IOrganizationProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async chat(input: ChatInput): Promise<ChatResult> {
    const startedAt = Date.now();
    const correlationId = getContext()?.correlationId ?? "internal";

    if (!input.organizationId) {
      throw new AppError({
        code: "assistant.no_organization",
        message: "Select an organization before using the assistant.",
        kind: "forbidden",
      });
    }
    const organizationId = input.organizationId;
    const message = input.message.trim();
    if (!message) {
      throw new AppError({
        code: "assistant.empty_message",
        message: "Ask me something first.",
        kind: "validation",
      });
    }

    // ── Identity for the prompt (same tenant, no elevated access) ────────────
    const [organization, userName] = await this.uow.transaction(async () => {
      const org = await this.orgs.getOrganization(organizationId);
      const name = await this.directory.userName(input.userId);
      return [org, name] as const;
    });

    // ── Conversation: load (owner-scoped) or create ─────────────────────────
    const conversation = await this.uow.transaction(async () => {
      if (input.conversationId) {
        const existing = await this.conversations.findForOwner(input.conversationId, input.userId);
        if (!existing) {
          throw new AppError({
            code: "assistant.conversation_not_found",
            message: "That conversation was not found.",
            kind: "not_found",
          });
        }
        return existing;
      }
      return this.conversations.create(input.userId, title(message));
    });

    const history = await this.uow.transaction(() =>
      this.conversations.recentMessages(conversation.id, this.config.maxHistoryMessages),
    );

    await this.uow.transaction(() =>
      this.conversations.appendMessage({
        conversationId: conversation.id,
        role: "user",
        content: message,
      }),
    );

    // ── Scope gate — keep the assistant on Mizan's domain ──────────────────
    const scope = await this.scope.check(message, history.length > 0);
    if (!scope.inScope) {
      const refusal = outOfScopeReply(input.locale);
      await this.uow.transaction(async () => {
        await this.conversations.appendMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: refusal,
          metadata: { refused: "out_of_scope", scopeVia: scope.via },
        });
        await this.conversations.touch(conversation.id);
      });
      await this.recordQueryAudit(input.userId, conversation.id, correlationId, {
        tools: [],
        resourceIds: [],
        refused: `scope:${scope.via}`,
      });
      this.observe({
        correlationId,
        input,
        organizationId,
        conversationId: conversation.id,
        iterations: 0,
        toolActivity: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - startedAt,
        ok: true,
        refused: scope.via,
      });
      return {
        conversationId: conversation.id,
        message: refusal,
        toolActivity: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // ── Build the working transcript ───────────────────────────────────────
    const toolCtx: ToolContext = {
      userId: input.userId,
      organizationId,
      locale: input.locale,
      correlationId,
      currentContext: input.currentContext,
    };
    const messages: AiMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt({
          ...toolCtx,
          now: this.clock.now(),
          organizationName: organization?.name ?? "your firm",
          userName: userName ?? "the user",
        }),
      },
      ...history.map(toAiMessage),
      { role: "user", content: message },
    ];

    const toolDefs = this.registry.openAiToolDefs();
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const add = (u: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => {
      usage.promptTokens += u.promptTokens ?? 0;
      usage.completionTokens += u.completionTokens ?? 0;
      usage.totalTokens += u.totalTokens ?? 0;
    };
    const toolActivity: ToolActivity[] = [];
    const resourceIds = new Set<string>();
    let iterations = 0;
    let finalText: string | null = null;

    try {
      while (iterations < this.config.maxToolIterations) {
        iterations++;
        const resp = await this.ai.createChatCompletion({
          messages,
          tools: toolDefs,
          signal: input.signal,
        });
        add(resp.usage);

        if (resp.toolCalls.length === 0) {
          finalText = resp.content.trim();
          break;
        }

        // Persist + append the assistant's tool-call turn.
        const stored: StoredToolCall[] = resp.toolCalls.map((c) => ({
          id: c.id,
          name: c.name,
          arguments: c.arguments,
        }));
        await this.uow.transaction(() =>
          this.conversations.appendMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: resp.content || null,
            toolCalls: stored,
          }),
        );
        messages.push({
          role: "assistant",
          content: resp.content || null,
          toolCalls: resp.toolCalls,
        });

        for (const call of resp.toolCalls) {
          const tool = this.registry.list().find((x) => x.name === call.name);
          for (const rid of extractResourceIds(call.arguments)) resourceIds.add(rid);
          const result = await this.registry.run(call.name, call.arguments, toolCtx);
          const rendered = renderToolResult(result);
          await this.uow.transaction(() =>
            this.conversations.appendMessage({
              conversationId: conversation.id,
              role: "tool",
              content: rendered,
              toolCallId: call.id,
              toolName: call.name,
              metadata: { ok: result.ok },
            }),
          );
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: rendered,
          });
          toolActivity.push({
            name: call.name,
            ok: result.ok,
            mutates: Boolean(tool?.mutates),
            error: result.error?.message,
          });
        }
      }

      // Hit the iteration cap with tool calls still pending — force a plain answer.
      if (finalText === null) {
        const resp = await this.ai.createChatCompletion({
          messages: [
            ...messages,
            {
              role: "user",
              content:
                "You've reached the tool-call limit for this turn. Answer now using only what you already have, and say if something is still missing.",
            },
          ],
          tools: [],
          signal: input.signal,
        });
        add(resp.usage);
        finalText = resp.content.trim();
      }
    } catch (err) {
      this.observe({
        correlationId,
        input,
        organizationId,
        conversationId: conversation.id,
        iterations,
        toolActivity,
        usage,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: err,
      });
      throw err;
    }

    const rawAnswer =
      finalText && finalText.length > 0
        ? finalText
        : "I couldn't put together an answer for that. Try rephrasing?";
    // Defence-in-depth only — nothing secret is ever in context (see response-guard.ts).
    const guarded = guardResponse(rawAnswer, correlationId);
    const answer = guarded.text;

    await this.uow.transaction(async () => {
      await this.conversations.appendMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: answer,
        metadata: {
          model: this.config.model,
          provider: this.config.provider,
          iterations,
          usage,
          latencyMs: Date.now() - startedAt,
          ...(guarded.redacted.length > 0 ? { redacted: guarded.redacted } : {}),
        },
      });
      await this.conversations.touch(conversation.id);
    });

    // Access record: every AI turn that ran, and which resources it touched.
    await this.recordQueryAudit(input.userId, conversation.id, correlationId, {
      tools: toolActivity.map((a) => `${a.name}:${a.ok ? "ok" : "err"}`),
      resourceIds: [...resourceIds],
      ...(guarded.redacted.length > 0 ? { redacted: guarded.redacted } : {}),
    });

    // A write tool that actually succeeded is separately an auditable mutation.
    const writes = toolActivity.filter((a) => a.mutates && a.ok).map((a) => a.name);
    if (writes.length > 0) {
      await this.uow.transaction(() =>
        this.audit.record({
          actorId: input.userId,
          action: "lawfirm.assistant.write",
          resourceType: "lawfirm_ai_conversation",
          resourceId: conversation.id,
          metadata: { tools: writes, correlationId },
        }),
      );
    }

    this.observe({
      correlationId,
      input,
      organizationId,
      conversationId: conversation.id,
      iterations,
      toolActivity,
      usage,
      latencyMs: Date.now() - startedAt,
      ok: true,
    });

    return { conversationId: conversation.id, message: answer, toolActivity, usage };
  }

  /** One `audit_logs` row per AI turn — who ran the assistant, what it invoked,
   *  which records it touched. Best-effort: a logging failure must not fail chat. */
  private async recordQueryAudit(
    userId: string,
    conversationId: string,
    correlationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.uow.transaction(() =>
        this.audit.record({
          actorId: userId,
          action: "lawfirm.assistant.query",
          resourceType: "lawfirm_ai_conversation",
          resourceId: conversationId,
          metadata: { ...metadata, correlationId },
        }),
      );
    } catch (err) {
      log.warn(
        { correlationId, err: err instanceof Error ? err.message : String(err) },
        "assistant query audit failed",
      );
    }
  }

  /** The caller's recent conversations (id + title + timestamp only). */
  async listConversations(
    userId: string,
    organizationId: string | null,
  ): Promise<Array<{ id: string; title: string | null; updatedAt: string }>> {
    if (!organizationId) return [];
    const rows = await this.uow.transaction(() => this.conversations.listForOwner(userId));
    return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
  }

  /** One conversation's transcript, owner-scoped. Tool plumbing is collapsed away. */
  async getConversation(
    userId: string,
    organizationId: string | null,
    conversationId: string,
  ): Promise<{
    id: string;
    title: string | null;
    messages: Array<{ role: "user" | "assistant"; content: string; at: string }>;
  }> {
    if (!organizationId) {
      throw new AppError({
        code: "assistant.no_organization",
        message: "Select an organization before using the assistant.",
        kind: "forbidden",
      });
    }
    return this.uow.transaction(async () => {
      const convo = await this.conversations.findForOwner(conversationId, userId);
      if (!convo) {
        throw new AppError({
          code: "assistant.conversation_not_found",
          message: "That conversation was not found.",
          kind: "not_found",
        });
      }
      const rows = await this.conversations.recentMessages(conversationId, 200);
      const messages = rows
        .filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            m.content !== null &&
            m.content.length > 0 &&
            !(m.toolCalls && m.toolCalls.length > 0),
        )
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content!,
          at: m.createdAt.toISOString(),
        }));
      return { id: convo.id, title: convo.title, messages };
    });
  }

  /** Observability — structured, and deliberately free of message/legal content. */
  private observe(o: {
    correlationId: string;
    input: ChatInput;
    organizationId: string;
    conversationId: string;
    iterations: number;
    toolActivity: ToolActivity[];
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    latencyMs: number;
    ok: boolean;
    error?: unknown;
    /** Set when the scope gate refused the request (its `via` value). */
    refused?: string;
  }): void {
    const line = {
      correlationId: o.correlationId,
      userId: o.input.userId,
      organizationId: o.organizationId,
      conversationId: o.conversationId,
      provider: this.config.provider,
      model: this.config.model,
      iterations: o.iterations,
      tools: o.toolActivity.map((t) => `${t.name}:${t.ok ? "ok" : "err"}`),
      toolCalls: o.toolActivity.length,
      promptTokens: o.usage.promptTokens,
      completionTokens: o.usage.completionTokens,
      totalTokens: o.usage.totalTokens,
      latencyMs: o.latencyMs,
      ok: o.ok,
      ...(o.refused ? { refused: o.refused } : {}),
    };
    if (o.refused) {
      log.info(line, "assistant chat refused — out of scope");
    } else if (o.ok) {
      log.info(line, "assistant chat completed");
    } else {
      log.warn(
        { ...line, err: o.error instanceof Error ? o.error.message : String(o.error) },
        "assistant chat failed",
      );
    }
  }
}

function title(message: string): string {
  const trimmed = message.replace(/\s+/g, " ").trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

/** Pull Mizan-id-shaped values out of a tool call's raw JSON args, for the audit
 *  trail. Purely observational — authorization never depends on this. */
function extractResourceIds(rawArguments: string): string[] {
  try {
    const args = JSON.parse(rawArguments) as Record<string, unknown>;
    const out: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (
        typeof value === "string" &&
        /id$/i.test(key) &&
        /^[a-z]{2,6}_[A-Za-z0-9_-]{6,40}$/.test(value)
      ) {
        out.push(value);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function toAiMessage(m: MessageRow): AiMessage {
  if (m.role === "tool") {
    return {
      role: "tool",
      toolCallId: m.toolCallId ?? "",
      name: m.toolName ?? "",
      content: m.content ?? "",
    };
  }
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content,
      ...(m.toolCalls && m.toolCalls.length > 0
        ? {
            toolCalls: m.toolCalls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments })),
          }
        : {}),
    };
  }
  return { role: "user", content: m.content ?? "" };
}

function renderToolResult(result: { ok: boolean; data?: unknown; error?: unknown }): string {
  const body = result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
  let json = JSON.stringify(body);
  if (json.length > MAX_TOOL_RESULT_CHARS) {
    json = JSON.stringify({
      ok: result.ok,
      truncated: true,
      note: "Result was too large and has been truncated. Narrow the query.",
      preview: json.slice(0, MAX_TOOL_RESULT_CHARS),
    });
  }
  return json;
}
