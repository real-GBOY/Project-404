import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { ValidationError } from "@core/kernel/errors.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { AuditRepository } from "@core/audit/infrastructure/audit-repository.js";
import { RealestateDirectory } from "@atlas/realestate/shared/directory.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { REALESTATE_ROLES } from "@atlas/realestate/shared/roles.js";
import { AdminRepository } from "../infrastructure/admin-repository.js";

function hrefFor(data: Record<string, unknown> | null): string | undefined {
  return data && typeof data.href === "string" ? data.href : undefined;
}

const REALESTATE_ROLE_KEYS = new Set(REALESTATE_ROLES.map((r) => r.key));
const ROLE_META = new Map(REALESTATE_ROLES.map((r) => [r.key, r.meta]));

/** Atlas adapter over Core RBAC + audit + notifications, reshaped for the "Administration" screens. */
@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly rbacRepo: RbacRepository,
    private readonly rbac: RbacService,
    private readonly audit: AuditRepository,
    private readonly directory: RealestateDirectory,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async roles() {
    return readInTenant(async () => {
      const [roles, counts] = await Promise.all([this.rbacRepo.listRoles(), this.repo.permissionCountByRole()]);
      return {
        items: roles
          .filter((r) => REALESTATE_ROLE_KEYS.has(r.key))
          .map((r) => ({
            key: r.key,
            name: r.name,
            permissions: counts.get(r.key) ?? 0,
            editable: r.key !== "administrator",
            ...ROLE_META.get(r.key),
          })),
      };
    });
  }

  async members() {
    return readInTenant(async () => {
      const rows = await this.repo.members();
      return {
        items: rows.map((m) => ({
          id: m.userId,
          name: m.name ?? m.email,
          email: m.email,
          role: m.roleKey ?? "—",
          status: "active" as const,
        })),
      };
    });
  }

  /** Replace-not-add: a member has exactly one real-estate role. */
  async assignRole(userId: string, roleKey: string, actorId: string) {
    if (!REALESTATE_ROLE_KEYS.has(roleKey)) {
      throw ValidationError("rbac.unknown_role", `Unknown role "${roleKey}".`);
    }
    const current = await readInTenant(() => this.repo.realestateRoleKeysFor(userId));
    for (const key of current) {
      if (key !== roleKey) await this.rbac.removeRole(userId, key);
    }
    if (!current.includes(roleKey)) {
      await this.rbac.assignRole(userId, roleKey, actorId);
    }
    return { ok: true };
  }

  async auditLogs(filter: { q?: string; action?: string; actor?: string }) {
    return readInTenant(async () => {
      const records = await this.audit.query({ limit: 200 });
      const names = await this.directory.userNames(records.map((r) => r.actorId));
      let items = records.map((r) => ({
        id: r.id,
        actor: r.actorId ? (names.get(r.actorId) ?? "—") : "system",
        action: r.action,
        resource: r.resourceId ? `${r.resourceType}:${r.resourceId}` : r.resourceType,
        at: r.createdAt.toISOString(),
      }));
      if (filter.action) items = items.filter((a) => a.action === filter.action);
      if (filter.actor) items = items.filter((a) => a.actor === filter.actor);
      const term = filter.q?.trim().toLowerCase();
      const filtered = term ? items.filter((a) => `${a.actor} ${a.action} ${a.resource}`.toLowerCase().includes(term)) : items;
      return { items: filtered.slice(0, 50), total: filtered.length };
    });
  }

  async notifications(userId: string, unreadOnly: boolean) {
    return readInTenant(async () => {
      const rows = await this.repo.notifications(userId, unreadOnly);
      return {
        items: rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
          href: hrefFor(n.data),
        })),
        unreadCount: await this.repo.unreadNotificationCount(userId),
      };
    });
  }

  markNotificationRead(userId: string, id: string) {
    return this.uow.transaction(() => this.repo.markNotificationRead(userId, id));
  }

  markAllNotificationsRead(userId: string) {
    return this.uow.transaction(() => this.repo.markAllNotificationsRead(userId));
  }
}
