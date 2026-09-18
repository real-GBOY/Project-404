import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { MESSAGING_PROVIDER } from "@core/kernel/tokens.js";
import type { IMessagingProvider } from "@core/contracts/index.js";
import type { AssistantTool, ConversationDto, MessageDto, ToolContext } from "@core/index.js";
import { FollowupsService } from "@atlas/realestate/crm/application/followups-service.js";
import { LeadsService } from "@atlas/realestate/crm/application/leads-service.js";
import { ConversationAnalysisRequester } from "@atlas/realestate/conversation-intelligence/application/analysis-requester.js";
import { ConversationInsightsReader } from "@atlas/realestate/conversation-intelligence/application/insights-reader.js";

const id = z.string().trim().min(1);
const isoDate = z
  .string()
  .datetime({ offset: true })
  .describe("ISO-8601 timestamp, e.g. 2026-09-10T09:00:00Z");

/** Bodies are user text of unbounded length — bound what reaches the model's context. */
const MAX_BODY = 600;

/**
 * The Copilot's window onto Core messaging. Follows the same rules as every other
 * Atlas tool (`read-tools.ts` / `write-tools.ts`):
 *
 *  - it runs through the existing `ToolRegistry` gate — parse → validate →
 *    live RBAC → execute — under the REQUESTING USER's identity;
 *  - it never touches the database: reads go through Core's `IMessagingProvider`,
 *    which enforces conversation MEMBERSHIP (a non-member, or another tenant, gets
 *    "not found"), so the AI sees exactly the conversations the user could open;
 *  - the one write goes through the existing `FollowupsService`, after confirming the
 *    lead is visible to the user.
 *
 * Analysis itself is never run inline — `request_conversation_analysis` only
 * queues it (asynchronous, like an incoming message would).
 */
@Injectable()
export class ConversationTools {
  constructor(
    @Inject(MESSAGING_PROVIDER) private readonly messaging: IMessagingProvider,
    private readonly insights: ConversationInsightsReader,
    private readonly requester: ConversationAnalysisRequester,
    private readonly followups: FollowupsService,
    private readonly leads: LeadsService,
  ) {}

  tools(): AssistantTool[] {
    const read = <S extends z.ZodTypeAny>(
      def: { name: string; description: string; resource: string; parameters: S },
      execute: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>,
    ): AssistantTool<S> => ({
      name: def.name,
      description: def.description,
      permission: { action: "read", resource: def.resource },
      parameters: def.parameters,
      execute,
    });

    return [
      read(
        {
          name: "list_conversations_for_lead",
          description: "List the conversations (that the current user belongs to) about a given lead.",
          resource: "conversation",
          parameters: z.object({ leadId: id }),
        },
        async (a, ctx) => {
          const list = await this.messaging.conversationsForSubject(ctx.userId, "lead", a.leadId);
          return { items: list.map(summarizeConversation), total: list.length };
        },
      ),
      read(
        {
          name: "get_conversation",
          description: "Get one conversation the user belongs to: members, last message, unread count.",
          resource: "conversation",
          parameters: z.object({ conversationId: id }),
        },
        async (a, ctx) => summarizeConversation(await this.messaging.getConversation(ctx.userId, a.conversationId)),
      ),
      read(
        {
          name: "get_conversation_messages",
          description:
            "The most recent messages of a conversation the user belongs to, oldest first, with sender names. Default 30, max 50.",
          resource: "conversation",
          parameters: z.object({ conversationId: id, limit: z.number().int().min(1).max(50).optional() }),
        },
        async (a, ctx) => {
          const conversation = await this.messaging.getConversation(ctx.userId, a.conversationId);
          const messages = await this.messaging.recentMessages(ctx.userId, a.conversationId, a.limit ?? 30);
          return { messages: messages.map((m) => shapeMessage(m, conversation)), returned: messages.length };
        },
      ),
      read(
        {
          name: "search_conversation_messages",
          description:
            "Search message text across the user's own conversations (or within one). Returns matching messages with their conversation id.",
          resource: "conversation",
          parameters: z.object({ query: z.string().trim().min(2).max(200), conversationId: id.optional() }),
        },
        async (a, ctx) => {
          const hits = await this.messaging.searchMessages(ctx.userId, {
            query: a.query,
            ...(a.conversationId ? { conversationId: a.conversationId } : {}),
            limit: 20,
          });
          return {
            hits: hits.map((h) => ({
              conversationId: h.conversationId,
              messageId: h.message.id,
              at: h.message.createdAt,
              body: clip(h.message.body),
            })),
            total: hits.length,
          };
        },
      ),
      read(
        {
          name: "get_conversation_insights",
          description:
            "The AI-maintained analysis of a conversation: summary, key facts (property type, bedrooms, location, budget, timeline…), action items, unresolved questions and extracted customer requirements. `stale: true` means newer messages are not analysed yet; `status` tells whether an analysis is running.",
          resource: "conversation_insight",
          parameters: z.object({ conversationId: id }),
        },
        (a, ctx) => this.insights.get(ctx.userId, a.conversationId),
      ),
      {
        name: "request_conversation_analysis",
        description:
          "Queue a fresh AI analysis of a conversation (it runs in the background; call get_conversation_insights afterwards). Use when insights are missing or stale.",
        permission: { action: "read", resource: "conversation_insight" },
        mutates: true,
        parameters: z.object({ conversationId: id }),
        execute: async (a: { conversationId: string }, ctx: ToolContext) => {
          await this.messaging.getConversation(ctx.userId, a.conversationId); // membership
          await this.requester.request(a.conversationId, "assistant");
          return { queued: true };
        },
      } satisfies AssistantTool,
      {
        name: "create_followup",
        description:
          "Create a follow-up for a lead with a reason and due date (e.g. from an action item in a conversation). Assigned to the current user.",
        permission: { action: "create", resource: "followup" },
        mutates: true,
        parameters: z.object({
          leadId: id,
          reason: z.string().trim().min(1).max(300),
          dueAt: isoDate,
          priority: z.enum(["high", "medium", "low"]).optional(),
        }),
        execute: async (
          a: { leadId: string; reason: string; dueAt: string; priority?: "high" | "medium" | "low" | undefined },
          ctx: ToolContext,
        ) => {
          await this.leads.get(a.leadId); // visible to this user, or NotFound
          return this.followups.create({
            leadId: a.leadId,
            reason: a.reason,
            dueAt: a.dueAt,
            priority: a.priority ?? "medium",
            agentId: ctx.userId,
          });
        },
      } satisfies AssistantTool,
    ];
  }
}

const clip = (text: string): string => (text.length <= MAX_BODY ? text : `${text.slice(0, MAX_BODY)}…`);

function summarizeConversation(c: ConversationDto) {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    subject: c.subjectType && c.subjectId ? { type: c.subjectType, id: c.subjectId } : null,
    members: c.members.filter((m) => !m.leftAt).map((m) => m.displayName),
    lastMessageAt: c.lastMessageAt,
    lastMessage: c.lastMessage && !c.lastMessage.deletedAt ? clip(c.lastMessage.body) : null,
    unreadCount: c.me?.unreadCount ?? 0,
    archived: c.archivedAt !== null,
  };
}

function shapeMessage(m: MessageDto, c: ConversationDto) {
  const sender = c.members.find((x) => x.userId === m.senderId)?.displayName ?? "Unknown";
  return {
    id: m.id,
    at: m.createdAt,
    from: sender,
    body: m.deletedAt ? "[deleted]" : clip(m.body),
    edited: m.editedAt !== null,
    attachments: m.attachments.map((a) => a.fileName),
  };
}
