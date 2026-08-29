import type { IOrganizationProvider, Organization } from "../../contracts/index.js";
import type { OrganizationRepository } from "./organization-repository.js";

/** IOrganizationProvider implementation (§4). No tenant context — single-tenant by default. */
export class OrganizationProvider implements IOrganizationProvider {
  constructor(private readonly repo: OrganizationRepository) {}

  getOrganization(orgId: string): Promise<Organization | null> {
    return this.repo.findById(orgId);
  }

  isMember(orgId: string, userId: string): Promise<boolean> {
    return this.repo.isMember(orgId, userId);
  }
}
