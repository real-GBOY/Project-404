import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { LeadsRepository } from "@atlas/realestate/crm/leads-repository.js";
import { AdminService } from "./admin-service.js";

/**
 * Team screen adapter: Core org membership + RBAC role, no dedicated staff-
 * profile table (Atlas's TeamMember fixture carries no fields beyond what
 * Core + a lead count already provide). `assignedLeads`/`salesMtd` are
 * derived, never separately authored — see the plan's data-model note.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly admin: AdminService,
    private readonly leads: LeadsRepository,
  ) {}

  async list() {
    return readInTenant(async () => {
      const members = await this.admin.members();
      const items = await Promise.all(
        members.items.map(async (m) => {
          const assignedLeads = (await this.leads.list({ agentId: m.id })).length;
          return { ...m, assignedLeads };
        }),
      );
      return { items };
    });
  }
}
