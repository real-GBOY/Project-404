import type { DomainEvent } from "@core/contracts/index.js";

export const ClientEvents = {
  Created: "lawfirm.client.created",
  Updated: "lawfirm.client.updated",
  Archived: "lawfirm.client.archived",
} as const;

export const clientCreated = (p: { clientId: string; name: string; actorId: string }): DomainEvent => ({
  name: ClientEvents.Created,
  version: 1,
  payload: p,
});

export const clientArchived = (p: { clientId: string; actorId: string }): DomainEvent => ({
  name: ClientEvents.Archived,
  version: 1,
  payload: p,
});
