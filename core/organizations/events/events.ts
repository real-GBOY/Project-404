import type { DomainEvent } from "../../contracts/domain-event.js";

export const OrganizationEvents = {
  Created: "organization.created",
  MemberAdded: "organization.member_added",
  MemberRemoved: "organization.member_removed",
} as const;

export const organizationCreated = (p: {
  organizationId: string;
  slug: string;
  createdBy: string | null;
}): DomainEvent => ({ name: OrganizationEvents.Created, version: 1, payload: p });

export const memberAdded = (p: {
  organizationId: string;
  userId: string;
  membershipRole: string;
}): DomainEvent => ({ name: OrganizationEvents.MemberAdded, version: 1, payload: p });

export const memberRemoved = (p: {
  organizationId: string;
  userId: string;
}): DomainEvent => ({ name: OrganizationEvents.MemberRemoved, version: 1, payload: p });
