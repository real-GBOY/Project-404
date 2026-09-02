import type { DomainEvent } from "@core/contracts/index.js";

export const MatterEvents = {
  Opened: "lawfirm.matter.opened",
  Closed: "lawfirm.matter.closed",
  UpdateAdded: "lawfirm.matter.update_added",
  Assigned: "lawfirm.matter.assigned",
} as const;

export const matterOpened = (p: { matterId: string; reference: string; actorId: string }): DomainEvent => ({
  name: MatterEvents.Opened,
  version: 1,
  payload: p,
});

export const matterClosed = (p: { matterId: string; actorId: string }): DomainEvent => ({
  name: MatterEvents.Closed,
  version: 1,
  payload: p,
});

export const matterAssigned = (p: { matterId: string; userId: string; role: string; actorId: string }): DomainEvent => ({
  name: MatterEvents.Assigned,
  version: 1,
  payload: p,
});
