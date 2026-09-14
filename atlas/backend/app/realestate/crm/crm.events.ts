import type { DomainEvent } from "@core/contracts/index.js";

export const CrmEvents = {
  LeadCreated: "realestate.lead.created",
  LeadStageChanged: "realestate.lead.stage_changed",
} as const;

export const leadCreated = (p: { leadId: string; name: string; actorId: string }): DomainEvent => ({
  name: CrmEvents.LeadCreated,
  version: 1,
  payload: p,
});

export const leadStageChanged = (p: {
  leadId: string;
  from: string;
  to: string;
  actorId: string;
}): DomainEvent => ({
  name: CrmEvents.LeadStageChanged,
  version: 1,
  payload: p,
});
