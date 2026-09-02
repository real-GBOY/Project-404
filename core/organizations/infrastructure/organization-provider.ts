import { Injectable } from "@nestjs/common";
import type {
  IOrganizationProvider,
  Organization,
  OrganizationMembership,
} from "@core/contracts/index.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { OrganizationRepository } from "./organization-repository.js";

/**
 * IOrganizationProvider implementation (§4). An organization *is* the tenant
 * (§ docs/tenancy.md), so this contract carries no separate tenant context.
 * Reads run through `readInTenant` so the RLS-scoped registry tables resolve.
 */
@Injectable()
export class OrganizationProvider implements IOrganizationProvider {
  constructor(private readonly repo: OrganizationRepository) {}

  getOrganization(orgId: string): Promise<Organization | null> {
    return readInTenant(() => this.repo.findById(orgId));
  }

  isMember(orgId: string, userId: string): Promise<boolean> {
    return readInTenant(() => this.repo.isMember(orgId, userId));
  }

  membershipsForUser(userId: string): Promise<OrganizationMembership[]> {
    return readInTenant(() => this.repo.membershipsForUser(userId));
  }
}
