import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { actorOf, requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { InspectionsRepository } from "@raqib/raqib/inspections/infrastructure/inspections-repository.js";
import { ObservationsService } from "@raqib/raqib/observations/application/observations-service.js";
import { ReportsService } from "@raqib/raqib/reports/application/reports-service.js";
import { InspectionsService, type InspectionView } from "@raqib/raqib/inspections/application/inspections-service.js";
import { letterFor, reviewNext, type ReviewAction } from "@raqib/raqib/visits/domain/visit-state.js";
import { VisitsService } from "@raqib/raqib/visits/application/visits-service.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { inspectionApproved, inspectionForwarded, inspectionRejected, inspectionReturned } from "../events.js";

export interface DecisionInput {
  /** Mandatory for return and reject. */
  reason?: string;
  /** Optional note when forwarding or approving. */
  comment?: string;
  /** The items sent back (return only). */
  itemIds?: string[];
}

const EVENT_ACTION: Record<ReviewAction, "reviewed" | "returned" | "rejected" | "approved"> = {
  forward: "reviewed",
  return: "returned",
  reject: "rejected",
  approve: "approved",
};

/**
 * The review workflow. Every decision is one transaction: lock the visit row, validate the state and the person's
 * authority, change the status, write the immutable decision (actor snapshot, from/to, reason), the audit entry and
 * the domain event. Review and approval are separate rights; nobody reviews their own inspection.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly visits: VisitsRepository,
    private readonly inspections: InspectionsRepository,
    private readonly inspectionService: InspectionsService,
    private readonly reports: ReportsService,
    private readonly observations: ObservationsService,
    private readonly visitsService: VisitsService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async decide(visitId: string, action: ReviewAction, input: DecisionInput, who: Access): Promise<InspectionView> {
    const reason = (input.reason ?? "").trim();
    if ((action === "return" || action === "reject") && reason.length < 3) {
      throw ValidationError(
        "raqib.reason_required",
        action === "return" ? "A reason is required to return an inspection." : "A reason is required to reject an inspection.",
      );
    }
    await this.uow.transaction(async () => {
      const v = await this.visits.find(visitId, true);
      if (!v) throw NotFound("raqib.visit_not_found", "Visit not found.");
      requireProject(who, v.projectId);
      if (v.inspectorId === who.userId) throw Forbidden("raqib.self_review", "You cannot review or approve your own inspection.");
      const to = reviewNext(v.status, action);
      if (!to) throw Conflict("raqib.invalid_transition", "This decision is not possible in the inspection's current state.");
      requireCan(who, "inspections", letterFor(v.status, action));
      const inspection = await this.inspections.findByVisit(visitId, true);
      if (!inspection) throw NotFound("raqib.inspection_not_started", "This visit has no inspection.");

      let itemIds: string[] = [];
      if (action === "return") {
        const items = new Set((await this.inspections.items(inspection.id)).filter((x) => x.kind === "site").map((x) => x.id));
        itemIds = [...new Set(input.itemIds ?? [])];
        if (itemIds.some((id) => !items.has(id))) throw ValidationError("raqib.item_not_found", "A flagged item does not belong to this inspection.");
        await this.inspections.addFlags(inspection.id, itemIds, v.round, who.userId);
      }

      await this.visits.update(visitId, { status: to });
      const note = action === "return" || action === "reject" ? reason : (input.comment ?? "").trim() || null;
      await this.visits.appendEvent({
        visitId,
        ...actorOf(who),
        action: EVENT_ACTION[action],
        fromStatus: v.status,
        toStatus: to,
        reason: note,
        detail: { action, round: v.round, ...(action === "return" ? { itemIds } : {}) },
      });
      await this.audit.record({
        actorId: who.userId,
        action: `raqib.inspection.${action === "forward" ? "forwarded" : action === "return" ? "returned" : action === "reject" ? "rejected" : "approved"}`,
        resourceType: "raqib_inspection",
        resourceId: inspection.id,
        before: { status: v.status },
        after: { status: to },
        metadata: { reason: note, round: v.round, flagged: itemIds.length },
      });
      const base = { visitId, actorId: who.userId };
      if (action === "forward") await this.events.publish(inspectionForwarded(base));
      if (action === "return") await this.events.publish(inspectionReturned({ ...base, reason }));
      if (action === "reject") await this.events.publish(inspectionRejected({ ...base, reason }));
      if (action === "approve") {
        // The report is frozen in the same transaction as the approval: no approved inspection without its report.
        const visitView = await this.visitsService.get(visitId, who);
        const inspectionView = await this.inspectionService.get(visitId, who);
        await this.observations.recordViolations(visitView, inspectionView, who);
        await this.reports.issue(visitId, who);
        await this.events.publish(inspectionApproved(base));
      }
    });
    return this.inspectionService.get(visitId, who);
  }
}
