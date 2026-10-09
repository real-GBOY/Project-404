import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { AUDIT_LOGGER, UNIT_OF_WORK, USER_PROVIDER } from "@core/kernel/tokens.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import type { IAuditLogger, IUserProvider } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { admitDb } from "@admit/admit/db/executor.js";

export const settingsPatchSchema = z
  .object({
    organizerName: z.string().trim().min(2).max(120).optional(),
    supportEmail: z.string().trim().email().max(200).nullable().optional(),
    logoUrl: z.string().trim().url().max(500).nullable().optional(),
    /** IANA zone shown on tickets and emails. v1 is single-timezone; the field exists so it is a setting, not a constant. */
    timeZone: z.string().trim().min(3).max(64).optional(),
  })
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export interface OrganizerProfile {
  organizerName: string;
  supportEmail: string | null;
  logoUrl: string | null;
  timeZone: string;
}

/** The organizer's public identity (one row per organization). Reads fall back to the organization's name and Cairo time. */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Call inside a tenant transaction. */
  async profile(): Promise<OrganizerProfile> {
    const orgId = requireOrganizationId();
    const [row, org] = await Promise.all([
      admitDb().selectFrom("admit_settings").select("data").where("organization_id", "=", orgId).executeTakeFirst(),
      currentExecutor().selectFrom("organizations").select("name").where("id", "=", orgId).executeTakeFirst(),
    ]);
    const d = (row?.data ?? {}) as Partial<OrganizerProfile>;
    return {
      organizerName: d.organizerName ?? org?.name ?? "Organizer",
      supportEmail: d.supportEmail ?? null,
      logoUrl: d.logoUrl ?? null,
      timeZone: d.timeZone ?? "Africa/Cairo",
    };
  }

  async me(who: Principal) {
    return readInTenant(async () => {
      const orgId = requireOrganizationId();
      const [user, profile, org] = await Promise.all([
        this.users.getUser(who.userId),
        this.profile(),
        currentExecutor().selectFrom("organizations").select(["id", "slug", "name"]).where("id", "=", orgId).executeTakeFirstOrThrow(),
      ]);
      const readsAll = who.permissions.some((p) => p === "read_all:event" || p === "*:*" || p === "*:event" || p === "read_all:*");
      return {
        user: { id: who.userId, email: user?.email ?? who.email, name: user?.displayName ?? user?.email ?? who.email },
        organizer: { id: org.id, slug: org.slug, name: profile.organizerName, supportEmail: profile.supportEmail, logoUrl: profile.logoUrl, timeZone: profile.timeZone },
        permissions: who.permissions,
        eventReach: readsAll ? ("all" as const) : ("assigned" as const),
      };
    });
  }

  get(): Promise<OrganizerProfile> {
    return readInTenant(() => this.profile());
  }

  async update(actorId: string, patch: SettingsPatch): Promise<OrganizerProfile> {
    return this.uow.transaction(async () => {
      const orgId = requireOrganizationId();
      const before = await this.profile();
      const next = { ...before, ...patch };
      await admitDb()
        .insertInto("admit_settings")
        .values({ organization_id: orgId, data: next, updated_by: actorId })
        .onConflict((oc) => oc.column("organization_id").doUpdateSet({ data: next, updated_by: actorId }))
        .execute();
      await this.audit.record({ actorId, action: "admit.settings.updated", resourceType: "admit_settings", resourceId: orgId, before, after: next });
      return next;
    });
  }
}
