import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import type { ChatRow, ChatStat } from "./assistant.domain.js";

export interface ConversationRow {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "ai";
  text: string;
  detail: string | null;
  recommend: string | null;
  stats: ChatStat[] | null;
  rows: ChatRow[] | null;
  cites: string[] | null;
  follow: string[] | null;
  isAction: boolean;
  createdAt: Date;
}

@Injectable()
export class AssistantRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async listConversations(userId: string): Promise<ConversationRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_ai_conversations")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("user_id", "=", userId)
      .orderBy("updated_at", "desc")
      .execute();
    return rows.map((r) => ({ id: r.id, userId: r.user_id, title: r.title, createdAt: new Date(r.created_at) }));
  }

  async createConversation(userId: string, title: string): Promise<ConversationRow> {
    const id = realestateId("conv");
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_ai_conversations")
      .values({ id, organization_id: org, user_id: userId, title })
      .execute();
    return { id, userId, title, createdAt: new Date() };
  }

  async messages(conversationId: string): Promise<MessageRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_ai_messages")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("conversation_id", "=", conversationId)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      text: r.text,
      detail: r.detail,
      recommend: r.recommend,
      stats: (r.stats as ChatStat[] | null) ?? null,
      rows: (r.rows as ChatRow[] | null) ?? null,
      cites: (r.cites as string[] | null) ?? null,
      follow: (r.follow as string[] | null) ?? null,
      isAction: r.is_action,
      createdAt: new Date(r.created_at),
    }));
  }

  async addMessage(input: {
    conversationId: string;
    role: "user" | "ai";
    text: string;
    detail?: string | null;
    recommend?: string | null;
    stats?: ChatStat[] | null;
    rows?: ChatRow[] | null;
    cites?: string[] | null;
    follow?: string[] | null;
    isAction?: boolean;
  }): Promise<MessageRow> {
    const id = realestateId("amsg");
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_ai_messages")
      .values({
        id,
        organization_id: org,
        conversation_id: input.conversationId,
        role: input.role,
        text: input.text,
        detail: input.detail ?? null,
        recommend: input.recommend ?? null,
        stats: input.stats ? JSON.stringify(input.stats) : null,
        rows: input.rows ? JSON.stringify(input.rows) : null,
        cites: input.cites ? JSON.stringify(input.cites) : null,
        follow: input.follow ? JSON.stringify(input.follow) : null,
        is_action: input.isAction ?? false,
      })
      .execute();
    return {
      id,
      conversationId: input.conversationId,
      role: input.role,
      text: input.text,
      detail: input.detail ?? null,
      recommend: input.recommend ?? null,
      stats: input.stats ?? null,
      rows: input.rows ?? null,
      cites: input.cites ?? null,
      follow: input.follow ?? null,
      isAction: input.isAction ?? false,
      createdAt: new Date(),
    };
  }
}
