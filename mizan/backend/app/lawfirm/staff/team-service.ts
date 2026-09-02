import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../../../../../core/kernel/db/db.js";
import { readInTenant } from "../../../../../core/kernel/db/db.js";
import { NotFound } from "../../../../../core/kernel/errors.js";
import { CLOCK, UNIT_OF_WORK, USER_PROVIDER } from "../../../../../core/kernel/tokens.js";
import type { Clock } from "../../../../../core/kernel/clock.js";
import type { IUserProvider } from "../../../../../core/contracts/index.js";
import { AdminService } from "../admin/admin-service.js";
import { LawfirmQueries } from "../shared/lawfirm-queries.js";
import { StaffRepository, type StaffProfileRow } from "./staff-repository.js";

const FEE_ROLES = new Set(["firm_admin", "partner", "lawyer"]);

@Injectable()
export class TeamService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly queries: LawfirmQueries,
    private readonly admin: AdminService,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async summary() {
    return readInTenant(async () => {
      const profiles = await this.repo.all();
      const active = profiles.filter((p) => p.status === "active");
      const views = await Promise.all(active.map((p) => this.view(p)));
      const feeEarners = views.filter((v) => FEE_ROLES.has(v.role)).length;
      return {
        feeEarners,
        support: active.length - feeEarners,
        avgUtilisation: 0,
        onLeave: profiles.filter((p) => p.status === "inactive").length,
      };
    });
  }

  async list() {
    return readInTenant(async () => {
      const profiles = await this.repo.all();
      const items = await Promise.all(
        profiles
          .slice()
          .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1))
          .map((p) => this.view(p)),
      );
      return { items };
    });
  }

  async get(id: string) {
    return readInTenant(async () => {
      const profile = await this.repo.findById(id);
      if (!profile) throw NotFound("staff.not_found", "Team member not found.");
      const base = await this.view(profile);
      const matters = (await this.queries.mattersForUser(profile.userId)).map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        role: m.isLead ? "Lead" : "Support",
      }));
      return { ...base, matters };
    });
  }

  async update(
    id: string,
    patch: { title?: string; phone?: string | null; practiceAreas?: string[]; weeklyCapacityHours?: number; status?: "active" | "inactive" },
  ) {
    const profile = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("staff.not_found", "Team member not found.");
      return this.repo.upsert({
        userId: existing.userId,
        title: patch.title,
        phone: patch.phone,
        practiceAreas: patch.practiceAreas,
        weeklyCapacityHours: patch.weeklyCapacityHours,
        status: patch.status,
      });
    });
    return readInTenant(() => this.view(profile));
  }

  private async view(p: StaffProfileRow) {
    const [user, roleKey, workload] = await Promise.all([
      this.users.getUser(p.userId),
      this.admin.roleKeyFor(p.userId),
      this.queries.workloadForUser(p.userId, this.clock.now()),
    ]);
    const role = roleKey ?? "read_only";
    return {
      id: p.id,
      name: user?.displayName ?? user?.email ?? "—",
      title: p.title,
      role,
      department: p.practiceAreas[0] ?? p.title,
      barAdmission: p.barAdmission ?? (FEE_ROLES.has(role) ? "—" : "—"),
      email: user?.email ?? "",
      phone: p.phone,
      practiceAreas: p.practiceAreas,
      status: p.status,
      weeklyCapacityHours: p.weeklyCapacityHours,
      activeMatters: workload.activeMatters,
      openTasks: workload.openTasks,
      upcomingHearings: workload.upcomingHearings,
      utilization: 0,
    };
  }
}
