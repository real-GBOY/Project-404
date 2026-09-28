import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { HOTEL_ROLE_KEYS } from "@hotel/hotel/shared/roles.js";

export interface StaffMemberRow {
  userId: string;
  name: string | null;
  email: string;
  userStatus: "active" | "pending" | "disabled";
  roleKey: string | null;
  joinedAt: Date;
  lastActiveAt: Date | null;
}

/**
 * Reads across Core identity/organization/RBAC tables to back the Staff & Permissions screens —
 * the same sanctioned exception as `atlas/backend/app/realestate/admin/admin-repository.ts`.
 * Writes never happen here: they go through Core's own services.
 */
@Injectable()
export class StaffRepository {
  async members(): Promise<StaffMemberRow[]> {
    const org = requireOrganizationId();
    const rows = await currentExecutor()
      .selectFrom("organization_members as m")
      .innerJoin("users as u", "u.id", "m.user_id")
      .leftJoin("user_roles as ur", (j) =>
        j.onRef("ur.user_id", "=", "m.user_id").on("ur.organization_id", "=", org),
      )
      .leftJoin("roles as r", (j) =>
        j.onRef("r.id", "=", "ur.role_id").on("r.key", "in", [...HOTEL_ROLE_KEYS]),
      )
      .where("m.organization_id", "=", org)
      .select((eb) => [
        "m.user_id as userId",
        "u.display_name as name",
        "u.email as email",
        "u.status as userStatus",
        "r.key as roleKey",
        "m.joined_at as joinedAt",
        eb
          .selectFrom("refresh_tokens as t")
          .whereRef("t.user_id", "=", "m.user_id")
          .select((e) => e.fn.max("t.created_at").as("last"))
          .as("lastActiveAt"),
      ])
      .execute();

    // A member may hold non-hotel roles too (e.g. Core admin); keep the hotel role when present.
    const byUser = new Map<string, StaffMemberRow>();
    for (const r of rows) {
      const existing = byUser.get(r.userId);
      if (!existing || (!existing.roleKey && r.roleKey)) {
        byUser.set(r.userId, {
          userId: r.userId,
          name: r.name,
          email: r.email,
          userStatus: r.userStatus,
          roleKey: r.roleKey,
          joinedAt: r.joinedAt,
          lastActiveAt: (r.lastActiveAt as Date | null) ?? null,
        });
      }
    }
    return [...byUser.values()].sort((a, b) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email),
    );
  }

  async hotelRoleKeysFor(userId: string): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("user_roles as ur")
      .innerJoin("roles as r", "r.id", "ur.role_id")
      .where("ur.user_id", "=", userId)
      .where("ur.organization_id", "=", requireOrganizationId())
      .where("r.key", "in", [...HOTEL_ROLE_KEYS])
      .select("r.key as key")
      .execute();
    return rows.map((r) => r.key);
  }

  async countWithRole(roleKey: string): Promise<number> {
    const row = await currentExecutor()
      .selectFrom("user_roles as ur")
      .innerJoin("roles as r", "r.id", "ur.role_id")
      .where("ur.organization_id", "=", requireOrganizationId())
      .where("r.key", "=", roleKey)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async isMember(userId: string): Promise<boolean> {
    const row = await currentExecutor()
      .selectFrom("organization_members")
      .select("id")
      .where("organization_id", "=", requireOrganizationId())
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return Boolean(row);
  }

  /** Permission keys currently granted to each hotel role. */
  async rolePermissionKeys(): Promise<Map<string, string[]>> {
    const rows = await currentExecutor()
      .selectFrom("role_permissions as rp")
      .innerJoin("roles as r", "r.id", "rp.role_id")
      .innerJoin("permissions as p", "p.id", "rp.permission_id")
      .where("r.key", "in", [...HOTEL_ROLE_KEYS])
      .select(["r.key as roleKey", "p.key as permissionKey"])
      .execute();
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const list = map.get(r.roleKey) ?? [];
      list.push(r.permissionKey);
      map.set(r.roleKey, list);
    }
    return map;
  }
}
