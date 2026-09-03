import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";

const LAWFIRM_ROLE_KEYS = ["firm_admin", "partner", "lawyer", "paralegal", "finance", "read_only"];

/**
 * Reads across a few Core tables to back the law-firm "Users & roles" and
 * "Security & audit" adapter endpoints. This sits at the composition-root
 * adapter layer — the same sanctioned exception as `mizan/backend/app/seed.ts`
 * reaching into `core/rbac` — and reshapes Core data to the exact contract the
 * web Settings screen expects.
 */
@Injectable()
export class AdminRepository {
  /** Members of the active tenant: `{ userId, name, email, roleKey }`. */
  async members(): Promise<
    Array<{ userId: string; name: string | null; email: string; roleKey: string | null }>
  > {
    const org = requireOrganizationId();
    const rows = await currentExecutor()
      .selectFrom("organization_members")
      .innerJoin("users", "users.id", "organization_members.user_id")
      .leftJoin("user_roles", (join) =>
        join
          .onRef("user_roles.user_id", "=", "organization_members.user_id")
          .on("user_roles.organization_id", "=", org),
      )
      .leftJoin("roles", (join) =>
        join.onRef("roles.id", "=", "user_roles.role_id").on("roles.key", "in", LAWFIRM_ROLE_KEYS),
      )
      .where("organization_members.organization_id", "=", org)
      .select([
        "organization_members.user_id as userId",
        "users.display_name as name",
        "users.email as email",
        "roles.key as roleKey",
      ])
      .orderBy("users.display_name")
      .execute();

    // one row per member; prefer a row that carries a law-firm role key
    const seen = new Map<
      string,
      { userId: string; name: string | null; email: string; roleKey: string | null }
    >();
    for (const r of rows) {
      const existing = seen.get(r.userId);
      if (!existing || (!existing.roleKey && r.roleKey)) seen.set(r.userId, r);
    }
    return [...seen.values()];
  }

  /** All law-firm role keys the user holds in the active tenant. */
  async lawfirmRoleKeysFor(userId: string): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("user_roles")
      .innerJoin("roles", "roles.id", "user_roles.role_id")
      .where("user_roles.user_id", "=", userId)
      .where("user_roles.organization_id", "=", requireOrganizationId())
      .where("roles.key", "in", LAWFIRM_ROLE_KEYS)
      .select("roles.key as key")
      .execute();
    return rows.map((r) => r.key);
  }

  async roleKeyFor(userId: string): Promise<string | null> {
    const row = await currentExecutor()
      .selectFrom("user_roles")
      .innerJoin("roles", "roles.id", "user_roles.role_id")
      .where("user_roles.user_id", "=", userId)
      .where("user_roles.organization_id", "=", requireOrganizationId())
      .where("roles.key", "in", LAWFIRM_ROLE_KEYS)
      .select("roles.key as key")
      .executeTakeFirst();
    return row?.key ?? null;
  }

  // ─── notifications (Core `notifications` table, RLS-scoped to the user) ─────
  async notifications(
    userId: string,
    unreadOnly: boolean,
  ): Promise<
    Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      data: Record<string, unknown> | null;
      readAt: Date | null;
      createdAt: Date;
    }>
  > {
    let q = currentExecutor()
      .selectFrom("notifications")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(50);
    if (unreadOnly) q = q.where("read_at", "is", null);
    const rows = await q.execute();
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: (r.data as Record<string, unknown> | null) ?? null,
      readAt: r.read_at ? new Date(r.read_at) : null,
      createdAt: new Date(r.created_at),
    }));
  }

  async unreadNotificationCount(userId: string): Promise<number> {
    const row = await currentExecutor()
      .selectFrom("notifications")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(row?.c ?? 0);
  }

  async markNotificationRead(userId: string, id: string): Promise<void> {
    await currentExecutor()
      .updateTable("notifications")
      .set({ read_at: new Date() })
      .where("user_id", "=", userId)
      .where("id", "=", id)
      .where("read_at", "is", null)
      .execute();
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await currentExecutor()
      .updateTable("notifications")
      .set({ read_at: new Date() })
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .execute();
  }

  async permissionCountByRole(): Promise<Map<string, number>> {
    const rows = await currentExecutor()
      .selectFrom("role_permissions")
      .innerJoin("roles", "roles.id", "role_permissions.role_id")
      .select((eb) => ["roles.key as key", eb.fn.countAll<string>().as("count")])
      .groupBy("roles.key")
      .execute();
    return new Map(rows.map((r) => [r.key, Number(r.count)]));
  }
}
