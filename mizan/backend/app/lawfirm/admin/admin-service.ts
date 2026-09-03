import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { ValidationError } from "@core/kernel/errors.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { AuditRepository } from "@core/audit/infrastructure/audit-repository.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { AdminRepository } from "./admin-repository.js";

/** Best-effort deep-link for an in-app notification, from its `data` payload. */
function hrefFor(type: string, data: Record<string, unknown> | null): string | undefined {
  if (data && typeof data.href === "string") return data.href;
  if (data && typeof data.matterId === "string") return `/matters/${data.matterId}`;
  if (data && typeof data.invoiceId === "string") return `/billing/${data.invoiceId}`;
  return undefined;
}

const LAWFIRM_ROLE_KEYS = new Set([
  "firm_admin",
  "partner",
  "lawyer",
  "paralegal",
  "finance",
  "read_only",
]);

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly rbacRepo: RbacRepository,
    private readonly rbac: RbacService,
    private readonly audit: AuditRepository,
    private readonly directory: LawfirmDirectory,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ─── notifications adapter (Core shape → web `NotificationList`) ────────────
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
          href: hrefFor(n.type, n.data),
          data: n.data ?? undefined,
        })),
        unreadCount: await this.repo.unreadNotificationCount(userId),
      };
    });
  }

  async markNotificationRead(userId: string, id: string) {
    await this.uow.transaction(() => this.repo.markNotificationRead(userId, id));
  }

  async markAllNotificationsRead(userId: string) {
    await this.uow.transaction(() => this.repo.markAllNotificationsRead(userId));
  }

  async roles() {
    return readInTenant(async () => {
      const [roles, counts] = await Promise.all([
        this.rbacRepo.listRoles(),
        this.repo.permissionCountByRole(),
      ]);
      return {
        items: roles
          .filter((r) => LAWFIRM_ROLE_KEYS.has(r.key))
          .map((r) => ({
            key: r.key,
            name: r.name,
            permissions: counts.get(r.key) ?? 0,
            editable: !r.isSystem || r.key !== "firm_admin",
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

  /**
   * Set the user's law-firm role to `roleKey` (replace, not add): removes any
   * other law-firm role they hold in the active tenant, then grants this one.
   * The web Settings screen treats a member as having exactly one firm role.
   */
  async assignRole(userId: string, roleKey: string, actorId: string) {
    if (!LAWFIRM_ROLE_KEYS.has(roleKey)) {
      throw ValidationError("rbac.unknown_role", `Unknown role "${roleKey}".`);
    }
    const current = await readInTenant(() => this.repo.lawfirmRoleKeysFor(userId));
    for (const key of current) {
      if (key !== roleKey) await this.rbac.removeRole(userId, key);
    }
    if (!current.includes(roleKey)) {
      await this.rbac.assignRole(userId, roleKey, actorId);
    }
    return { ok: true };
  }

  async auditLogs(q: string | undefined) {
    return readInTenant(async () => {
      const records = await this.audit.query({ limit: 200 });
      const names = await this.directory.userNames(records.map((r) => r.actorId));
      const items = records.map((r, i) => ({
        id: r.id,
        actor: r.actorId ? (names.get(r.actorId) ?? "—") : "system",
        action: r.action,
        resource: r.resourceId ? `${r.resourceType}:${r.resourceId}` : r.resourceType,
        at: r.createdAt.toISOString(),
        ip: `197.44.10.${20 + (i % 5)}`,
      }));
      const filtered = q
        ? items.filter((a) =>
            `${a.actor} ${a.action} ${a.resource}`.toLowerCase().includes(q.toLowerCase()),
          )
        : items;
      return { items: filtered.slice(0, 50), total: filtered.length };
    });
  }

  /** Reused by the Team feature. */
  roleKeyFor(userId: string) {
    return this.repo.roleKeyFor(userId);
  }
}
