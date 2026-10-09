import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { actorOf, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { InspectionsRepository } from "@raqib/raqib/inspections/infrastructure/inspections-repository.js";
import { ScoringRepository } from "@raqib/raqib/scoring/infrastructure/scoring-repository.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { CorrectionsRepository, type CorrectionField, type CorrectionRecord } from "../infrastructure/corrections-repository.js";

export interface CorrectionInput {
  inspectionId: string;
  field: CorrectionField;
  /** ISO timestamp for the time fields; whole points for `deduction_amount`. */
  value: string | number;
  /** Required for `deduction_amount`: which violation. */
  itemKey?: string;
  reason: string;
}

export interface CorrectionView {
  id: string;
  field: CorrectionField;
  itemKey: string | null;
  previous: string | null;
  next: string;
  reason: string;
  at: string;
  by: { id: string | null; nameAr: string; nameEn: string; role: string | null };
}

const view = (c: CorrectionRecord): CorrectionView => ({
  id: c.id,
  field: c.field,
  itemKey: c.itemKey,
  previous: c.previousValue,
  next: c.newValue,
  reason: c.reason,
  at: c.at.toISOString(),
  by: { id: c.actor.id, nameAr: c.actor.nameAr, nameEn: c.actor.nameEn, role: c.actor.role },
});

/**
 * The only way system-generated inspection data changes after the fact. Times need the approve right on inspections;
 * a deduction needs the scoring designation. Each correction is one append-only row (previous value, new value, who,
 * role, when, why) plus an audit entry; issued reports stay as they were frozen.
 */
@Injectable()
export class CorrectionsService {
  constructor(
    private readonly repo: CorrectionsRepository,
    private readonly inspections: InspectionsRepository,
    private readonly visits: VisitsRepository,
    private readonly scoring: ScoringRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(inspectionId: string, who: Access): Promise<CorrectionView[]> {
    requireCan(who, "inspections", "R");
    return readInTenant(async () => {
      const i = await this.inspections.find(inspectionId);
      const v = i ? await this.visits.find(i.visitId) : null;
      if (!i || !v) throw NotFound("raqib.inspection_not_found", "Inspection not found.");
      requireProject(who, v.projectId);
      return (await this.repo.forInspection(inspectionId)).map(view);
    });
  }

  async correct(input: CorrectionInput, who: Access): Promise<CorrectionView[]> {
    const reason = input.reason.trim();
    if (reason.length < 3) throw ValidationError("raqib.reason_required", "A reason is required for a correction.");
    return this.uow.transaction(async () => {
      const i = await this.inspections.find(input.inspectionId);
      const v = i ? await this.visits.find(i.visitId, true) : null;
      if (!i || !v) throw NotFound("raqib.inspection_not_found", "Inspection not found.");
      requireProject(who, v.projectId);
      if (!i.submittedAt) throw Conflict("raqib.not_submitted", "Only a submitted inspection can be corrected.");
      let previous: string | null;
      let next: string;

      if (input.field === "deduction_amount") {
        if (!(await this.scoring.isDesignee(who.userId, "scoring_admin"))) {
          throw Forbidden("raqib.not_scoring_admin", "Only the person designated to manage scoring can correct a deduction.");
        }
        const amount = Number(input.value);
        if (!Number.isInteger(amount) || amount < 0 || amount > 100)
          throw ValidationError("raqib.invalid_value", "A deduction is a whole number from 0 to 100.");
        if (!input.itemKey) throw ValidationError("raqib.item_required", "Say which violation to correct.");
        const rows = await this.scoring.deductionsOf(i.id);
        const row = rows.find((r) => r.itemKey === input.itemKey);
        if (!row) throw NotFound("raqib.deduction_not_found", "This inspection has no deduction for that item.");
        const config = i.scoringConfigId ? await this.scoring.byId(i.scoringConfigId) : null;
        if (!config) throw Conflict("raqib.not_deduction_scored", "This inspection was not scored by deductions.");
        previous = String(row.amount);
        next = String(amount);
        await this.scoring.setDeductionAmount(i.id, input.itemKey, amount);
        const total = rows.reduce((a, r) => a + (r.itemKey === input.itemKey ? amount : r.amount), 0);
        await this.inspections.setScore(i.id, Math.max(0, config.base - total));
      } else {
        requireCan(who, "inspections", "P");
        const at = new Date(String(input.value));
        if (Number.isNaN(at.getTime())) throw ValidationError("raqib.invalid_value", "Enter a valid date and time.");
        if (at.getTime() > this.clock.now().getTime()) throw ValidationError("raqib.in_future", "A recorded time cannot be in the future.");
        const startedAt = input.field === "started_at" ? at : i.startedAt;
        const submittedAt = input.field === "submitted_at" ? at : i.submittedAt;
        if (startedAt.getTime() > submittedAt.getTime()) throw ValidationError("raqib.time_order", "An inspection cannot start after it was submitted.");
        previous = (input.field === "started_at" ? i.startedAt : i.submittedAt).toISOString();
        next = at.toISOString();
        await this.inspections.setTime(i.id, input.field, at);
      }

      const actor = actorOf(who);
      await this.repo.insert({
        inspectionId: i.id,
        visitId: v.id,
        projectId: v.projectId,
        field: input.field,
        itemKey: input.itemKey ?? null,
        previousValue: previous,
        newValue: next,
        reason,
        actor: { id: actor.actorId, nameAr: actor.actorNameAr, nameEn: actor.actorNameEn, role: actor.actorRole },
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.inspection.corrected",
        resourceType: "raqib_inspection",
        resourceId: i.id,
        before: { [input.field]: previous },
        after: { [input.field]: next },
        metadata: { reason, itemKey: input.itemKey ?? null },
      });
      return (await this.repo.forInspection(i.id)).map(view);
    });
  }
}
