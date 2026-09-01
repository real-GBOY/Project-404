import { Inject, Injectable } from "@nestjs/common";
import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { Clock } from "../../kernel/clock.js";
import { CLOCK } from "../../kernel/tokens.js";
import { currentOrganizationId } from "../../kernel/tenant.js";

export interface NotificationRow {
  id: string;
  userId: string;
  organizationId: string | null;
  type: string;
  title: string;
  body: string;
  locale: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationRepository {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async insert(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    locale: string;
    data?: Record<string, unknown> | null;
  }): Promise<string> {
    const id = newId("ntf");
    await currentExecutor()
      .insertInto("notifications")
      .values({
        id,
        user_id: input.userId,
        // NULL for account-level notifications (welcome, security); the active
        // tenant otherwise. See docs/tenancy.md.
        organization_id: currentOrganizationId(),
        type: input.type,
        title: input.title,
        body: input.body,
        locale: input.locale,
        data: input.data ?? null,
      })
      .execute();
    return id;
  }

  async listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number; cursor?: string } = {},
  ): Promise<NotificationRow[]> {
    let q = currentExecutor().selectFrom("notifications").selectAll().where("user_id", "=", userId);
    if (opts.unreadOnly) q = q.where("read_at", "is", null);
    if (opts.cursor) q = q.where("id", "<", opts.cursor);
    const rows = await q
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(Math.min(opts.limit ?? 30, 100))
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async unreadCount(userId: string): Promise<number> {
    const row = await currentExecutor()
      .selectFrom("notifications")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async markRead(userId: string, id: string): Promise<void> {
    await currentExecutor()
      .updateTable("notifications")
      .set({ read_at: this.clock.now() })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .execute();
  }

  async markAllRead(userId: string): Promise<void> {
    await currentExecutor()
      .updateTable("notifications")
      .set({ read_at: this.clock.now() })
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .execute();
  }

  private toRow(r: {
    id: string;
    user_id: string;
    organization_id: string | null;
    type: string;
    title: string;
    body: string;
    locale: string;
    data: unknown;
    read_at: Date | null;
    created_at: Date;
  }): NotificationRow {
    return {
      id: r.id,
      userId: r.user_id,
      organizationId: r.organization_id,
      type: r.type,
      title: r.title,
      body: r.body,
      locale: r.locale,
      data: (r.data as Record<string, unknown> | null) ?? null,
      readAt: r.read_at ? new Date(r.read_at) : null,
      createdAt: new Date(r.created_at),
    };
  }
}
