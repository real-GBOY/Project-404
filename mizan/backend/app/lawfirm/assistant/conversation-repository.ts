import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export type StoredRole = "user" | "assistant" | "tool";

export interface StoredToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ConversationRow {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: StoredRole;
  content: string | null;
  toolCalls: StoredToolCall[] | null;
  toolCallId: string | null;
  toolName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AppendMessageInput {
  conversationId: string;
  role: StoredRole;
  content?: string | null;
  toolCalls?: StoredToolCall[] | null;
  toolCallId?: string | null;
  toolName?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * The Copilot conversation store. Tenant-scoped like every other law-firm repo
 * (`organization_id` column + RLS). A conversation is private to its owning
 * user *within* its tenant — `findForOwner` is the only read path and it filters
 * on both.
 */
@Injectable()
export class ConversationRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async create(userId: string, title: string | null): Promise<ConversationRow> {
    const id = lawfirmId("conv");
    await currentExecutor()
      .insertInto("lawfirm_ai_conversations")
      .values({ id, organization_id: this.org(), user_id: userId, title })
      .execute();
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<ConversationRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_ai_conversations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toConversation(row) : null;
  }

  /** The one authorized read: this conversation, only if `userId` owns it. */
  async findForOwner(id: string, userId: string): Promise<ConversationRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_ai_conversations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? toConversation(row) : null;
  }

  async listForOwner(userId: string, limit = 30): Promise<ConversationRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_ai_conversations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("user_id", "=", userId)
      .orderBy("updated_at", "desc")
      .limit(limit)
      .execute();
    return rows.map(toConversation);
  }

  async setTitleIfEmpty(id: string, title: string): Promise<void> {
    await currentExecutor()
      .updateTable("lawfirm_ai_conversations")
      .set({ title })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("title", "is", null)
      .execute();
  }

  async touch(id: string): Promise<void> {
    await currentExecutor()
      .updateTable("lawfirm_ai_conversations")
      .set({ updated_at: new Date() })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async appendMessage(input: AppendMessageInput): Promise<MessageRow> {
    const id = lawfirmId("amsg");
    await currentExecutor()
      .insertInto("lawfirm_ai_messages")
      .values({
        id,
        organization_id: this.org(),
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        // Json<Array<...>> — arrays must be pre-stringified for node-postgres.
        tool_calls: input.toolCalls ? JSON.stringify(input.toolCalls) : null,
        tool_call_id: input.toolCallId ?? null,
        tool_name: input.toolName ?? null,
        metadata: input.metadata ?? null,
      })
      .execute();
    return (await this.messageById(id))!;
  }

  async recentMessages(conversationId: string, limit: number): Promise<MessageRow[]> {
    // Newest `limit`, returned oldest-first so the transcript reads in order.
    const rows = await currentExecutor()
      .selectFrom("lawfirm_ai_messages")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
    return rows.map(toMessage).reverse();
  }

  private async messageById(id: string): Promise<MessageRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_ai_messages")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toMessage(row) : null;
  }
}

function toConversation(r: {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): ConversationRow {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function toMessage(r: {
  id: string;
  conversation_id: string;
  role: StoredRole;
  content: string | null;
  tool_calls: unknown;
  tool_call_id: string | null;
  tool_name: string | null;
  metadata: unknown;
  created_at: Date | string;
}): MessageRow {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolCalls: (r.tool_calls as StoredToolCall[] | null) ?? null,
    toolCallId: r.tool_call_id,
    toolName: r.tool_name,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: new Date(r.created_at),
  };
}
