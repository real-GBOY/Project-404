import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { LeadsRepository } from "@atlas/realestate/crm/leads-repository.js";
import { AdminService } from "./admin-service.js";

export interface TeamFilter {
  role?: string;
  /** Free-text search across name/email — the team roster is small, so this
   *  is a plain substring match rather than the SQL relevance algorithm. */
  q?: string;
}

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

  async list(filter: TeamFilter = {}) {
    return readInTenant(async () => {
      const members = await this.admin.members();
      let items = await Promise.all(
        members.items.map(async (m) => {
          const assignedLeads = (await this.leads.list({ agentId: m.id })).length;
          return { ...m, assignedLeads };
        }),
      );
      if (filter.role) items = items.filter((m) => m.role === filter.role);
      const term = filter.q?.trim().toLowerCase();
      if (term) items = items.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(term));
      return { items };
    });
  }
}
