import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { AccessRepository } from "@raqib/raqib/access/infrastructure/access-repository.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { ScoringRepository, type ScoringConfigRecord } from "../infrastructure/scoring-repository.js";

export interface ScoringConfigView {
  id: string;
  version: number;
  base: number;
  bySeverity: Record<string, number>;
  byItem: Record<string, number>;
  reason: string;
  createdAt: string;
}
export interface ScoringOverview {
  /** `null` until the client's deduction values are entered; the previous weighted policy scores meanwhile. */
  current: ScoringConfigView | null;
  history: ScoringConfigView[];
  /** Whether the caller is a person named to publish deduction rules. */
  canPublish: boolean;
  designees: Array<{ userId: string; name: L10n; at: string }>;
  /** For the General Manager only: the active people who could be named scoring manager. */
  candidates: Array<{ userId: string; name: L10n; role: string }>;
}
export interface PublishInput {
  bySeverity: Record<string, number>;
  byItem: Record<string, number>;
  reason: string;
}

const view = (c: ScoringConfigRecord): ScoringConfigView => ({
  id: c.id,
  version: c.version,
  base: c.base,
  bySeverity: c.bySeverity,
  byItem: c.byItem,
  reason: c.reason,
  createdAt: c.createdAt.toISOString(),
});

/**
 * Deduction rules. Publishing is NOT a permission-template right: only a person the General Manager has named
 * (`raqib_designations`) may publish, so ordinary settings access can never change how inspections are scored.
 * Every publish is a new immutable version; an inspection keeps the version it was started under.
 */
@Injectable()
export class ScoringService {
  constructor(
    private readonly repo: ScoringRepository,
    private readonly access: AccessService,
    private readonly profiles: AccessRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async overview(who: Access): Promise<ScoringOverview> {
    requireCan(who, "settings", "V");
    return readInTenant(async () => {
      const [current, history, designees, mine] = await Promise.all([
        this.repo.latest(),
        this.repo.history(),
        this.repo.designees("scoring_admin"),
        this.repo.isDesignee(who.userId, "scoring_admin"),
      ]);
      const named = await Promise.all(
        designees.map(async (d) => {
          const p = await this.access.profileOf(d.userId);
          return { userId: d.userId, name: { ar: p?.nameAr ?? d.userId, en: p?.nameEn ?? d.userId }, at: d.at.toISOString() };
        }),
      );
      const candidates =
        who.role === "gm"
          ? (await this.profiles.allProfiles())
              .filter((p) => p.status === "active" && !designees.some((d) => d.userId === p.userId))
              .map((p) => ({ userId: p.userId, name: { ar: p.nameAr, en: p.nameEn }, role: p.roleKey }))
          : [];
      return { current: current ? view(current) : null, history: history.map(view), canPublish: mine, designees: named, candidates };
    });
  }

  async publish(input: PublishInput, who: Access): Promise<ScoringConfigView> {
    return this.uow.transaction(async () => {
      if (!(await this.repo.isDesignee(who.userId, "scoring_admin"))) {
        throw Forbidden("raqib.not_scoring_admin", "Only the person designated to manage scoring can change deduction rules.");
      }
      if (!input.reason.trim()) throw ValidationError("raqib.reason_required", "A reason is required.");
      if (!Object.keys(input.bySeverity).length && !Object.keys(input.byItem).length) {
        throw ValidationError("raqib.empty_scoring", "Enter at least one deduction value.");
      }
      const prev = await this.repo.latest();
      const created = await this.repo.insert({
        base: 100,
        bySeverity: input.bySeverity,
        byItem: input.byItem,
        reason: input.reason.trim(),
        createdBy: who.userId,
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.scoring.published",
        resourceType: "raqib_scoring_config",
        resourceId: created.id,
        before: prev ? { version: prev.version, bySeverity: prev.bySeverity, byItem: prev.byItem } : undefined,
        after: { version: created.version, bySeverity: created.bySeverity, byItem: created.byItem },
        metadata: { reason: input.reason.trim() },
      });
      return view(created);
    });
  }

  // ── designations (General Manager only) ─────────────────────────────────

  async designate(userId: string, who: Access): Promise<void> {
    if (who.role !== "gm") throw Forbidden("raqib.gm_only", "Only the General Manager names who manages scoring.");
    await this.uow.transaction(async () => {
      if (!(await this.access.profileOf(userId))) throw NotFound("raqib.user_not_found", "Person not found.");
      if (!(await this.repo.addDesignee(userId, "scoring_admin", who.userId))) throw Conflict("raqib.already_designated", "This person is already designated.");
      await this.audit.record({ actorId: who.userId, action: "raqib.scoring.designated", resourceType: "raqib_user", resourceId: userId });
    });
  }

  async revoke(userId: string, who: Access): Promise<void> {
    if (who.role !== "gm") throw Forbidden("raqib.gm_only", "Only the General Manager names who manages scoring.");
    await this.uow.transaction(async () => {
      if (!(await this.repo.removeDesignee(userId, "scoring_admin"))) throw NotFound("raqib.not_designated", "This person is not designated.");
      await this.audit.record({ actorId: who.userId, action: "raqib.scoring.designation_revoked", resourceType: "raqib_user", resourceId: userId });
    });
  }
}
