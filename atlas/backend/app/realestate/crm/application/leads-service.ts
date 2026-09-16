import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { LeadsRepository, type CreateLeadInput, type LeadFilter } from "../infrastructure/leads-repository.js";
import type { CreateLeadBody, TrackAsDealBody, UpdateLeadBody } from "../validation/leads.schema.js";
import { leadStageChanged } from "../events/crm.events.js";

@Injectable()
export class LeadsService {
  constructor(
    private readonly repo: LeadsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: LeadFilter) {
    return readInTenant(() => this.repo.list(filter));
  }

  async get(id: string) {
    const lead = await readInTenant(() => this.repo.findById(id));
    if (!lead) throw NotFound("lead.not_found", "Lead not found.");
    return lead;
  }

  async create(body: CreateLeadBody, actorId: string) {
    const input: CreateLeadInput = body;
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.lead.created",
        resourceType: "realestate_lead",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(id: string, body: UpdateLeadBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("lead.not_found", "Lead not found.");
      // Keep `stage` following `status` unless the caller (Pipeline drag-drop) sets stage explicitly.
      const patch = { ...body, stage: body.stage ?? (body.status as UpdateLeadBody["stage"] | undefined) };
      const updated = await this.repo.update(id, patch);
      if (patch.stage && patch.stage !== before.stage) {
        await this.events.publish(leadStageChanged({ leadId: id, from: before.stage, to: patch.stage, actorId }));
      }
      await this.audit.record({
        actorId,
        action: "realestate.lead.updated",
        resourceType: "realestate_lead",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
  }

  /** Moves a Pipeline card by setting `stage` directly (drag-and-drop), independent of `status`. */
  async moveStage(id: string, stage: UpdateLeadBody["stage"], actorId: string) {
    return this.update(id, { stage }, actorId);
  }

  async trackAsDeal(id: string, body: TrackAsDealBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("lead.not_found", "Lead not found.");
      const updated = await this.repo.update(id, {
        probabilityPct: body.probabilityPct,
        expectedCloseDate: body.expectedCloseDate,
      });
      await this.audit.record({
        actorId,
        action: "realestate.lead.tracked_as_deal",
        resourceType: "realestate_lead",
        resourceId: id,
        after: updated,
      });
      return updated!;
    });
  }
}
