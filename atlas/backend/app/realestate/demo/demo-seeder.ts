import { Injectable } from "@nestjs/common";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import type { Clock } from "@core/kernel/clock.js";
import { ProjectsService } from "@atlas/realestate/properties/application/projects-service.js";
import { BuildingsService } from "@atlas/realestate/properties/application/buildings-service.js";
import { UnitsService } from "@atlas/realestate/properties/application/units-service.js";
import { LeadsService } from "@atlas/realestate/crm/application/leads-service.js";
import { LeadsRepository } from "@atlas/realestate/crm/infrastructure/leads-repository.js";
import { CustomersService } from "@atlas/realestate/crm/application/customers-service.js";
import { ActivitiesService } from "@atlas/realestate/crm/application/activities-service.js";
import { ReservationsService } from "@atlas/realestate/sales/application/reservations-service.js";
import { ContractsService } from "@atlas/realestate/sales/application/contracts-service.js";
import { PaymentPlansService } from "@atlas/realestate/sales/application/payment-plans-service.js";
import { PaymentsService } from "@atlas/realestate/finance/application/payments-service.js";
import { TasksService } from "@atlas/realestate/operations/application/tasks-service.js";
import { ApprovalsService } from "@atlas/realestate/operations/application/approvals-service.js";
import { WorkflowsService } from "@atlas/realestate/operations/application/workflows-service.js";
import { InsightsRepository } from "@atlas/realestate/assistant/infrastructure/insights-repository.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import {
  DEMO_ACTIVITIES,
  DEMO_DASHBOARD_INSIGHTS,
  DEMO_FEED_INSIGHTS,
  DEMO_LEADS,
  DEMO_PROJECT_VELOCITY,
  DEMO_PROJECTS,
  DEMO_SALES_CHAINS,
  DEMO_TEAM,
} from "./demo-data.js";

const log = moduleLogger("atlas-demo-seed");
const DEMO_PASSWORD = "demo-password-2026";
const DEMO_SLUG = "atlas-developments";

/**
 * Opt-in demo dataset (`ATLAS_SEED_DEMO=true`, run from `AppSeedService`
 * only). Idempotent: skips entirely if the demo org already exists. Ported
 * from `atlas/web/src/mocks/fixtures/*` (see demo-data.ts's header note on
 * reconciling known fixture inconsistencies rather than copying them).
 * Mirrors `mizan/backend/app/lawfirm/demo/demo-seeder.ts`'s shape.
 */
@Injectable()
export class DemoSeeder {
  constructor(
    private readonly rbac: RbacService,
    private readonly projects: ProjectsService,
    private readonly buildings: BuildingsService,
    private readonly units: UnitsService,
    private readonly leads: LeadsService,
    private readonly leadsRepo: LeadsRepository,
    private readonly customers: CustomersService,
    private readonly activities: ActivitiesService,
    private readonly reservations: ReservationsService,
    private readonly contracts: ContractsService,
    private readonly paymentPlans: PaymentPlansService,
    private readonly payments: PaymentsService,
    private readonly tasks: TasksService,
    private readonly approvals: ApprovalsService,
    private readonly workflows: WorkflowsService,
    private readonly insights: InsightsRepository,
  ) {}

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() =>
      currentExecutor().selectFrom("organizations").select("id").where("slug", "=", DEMO_SLUG).executeTakeFirst(),
    );
    if (already) {
      log.info("demo data already present — skipping");
      return;
    }

    const now = clock.now();
    const userId = new Map<string, string>();
    const orgId = newId("org");
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const t of DEMO_TEAM) {
          const id = newId("usr");
          userId.set(t.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: t.email,
              email_normalized: t.email,
              password_hash: passwordHash,
              display_name: t.name,
              status: "active",
              email_verified_at: now,
              locale: "en",
            })
            .execute();
        }
        await ex.insertInto("organizations").values({ id: orgId, name: "Atlas Developments", slug: DEMO_SLUG, settings: {} }).execute();
        for (const t of DEMO_TEAM) {
          await ex
            .insertInto("organization_members")
            .values({
              id: newId("mem"),
              organization_id: orgId,
              user_id: userId.get(t.key)!,
              membership_role: t.key === "usr_dev" ? "owner" : "member",
            })
            .execute();
        }
      }),
    );

    const adminId = userId.get("usr_dev")!;
    for (const t of DEMO_TEAM) {
      await runAsSystem(() => this.rbac.assignRole(userId.get(t.key)!, t.roleKey, adminId, orgId));
    }

    await withContext({ userId: adminId, organizationId: orgId }, async () => {
      const projectId = new Map<string, string>();
      for (const p of DEMO_PROJECTS) {
        const project = await this.projects.create(
          { name: p.name, location: p.location, developer: p.developer, status: p.status },
          adminId,
        );
        projectId.set(p.key, project.id);
        for (const b of p.buildings) {
          const building = await this.buildings.create(
            { projectId: project.id, key: b.key, name: b.name, floors: b.floors, unitsPerFloor: b.unitsPerFloor },
            adminId,
          );
          await this.units.generateForBuilding(building.id, adminId);
        }
      }

      for (const l of DEMO_LEADS) {
        const lead = await this.leads.create(
          {
            name: l.name,
            phone: l.phone,
            source: l.source,
            agentId: userId.get(l.agentKey)!,
            interestText: l.interestText,
            valueEgp: Math.round(l.valueEgpM * 1_000_000),
          },
          adminId,
        );
        // Every lead starts at "new" — move the ones with a further stage so the
        // Pipeline board and the dashboard's Lead Conversion Funnel both read as
        // a real, decaying funnel rather than one bar.
        if (l.stage && l.stage !== "new") await this.leads.moveStage(lead.id, l.stage, adminId);
        if (l.trackAsDeal) await this.leads.trackAsDeal(lead.id, { probabilityPct: 55, expectedCloseDate: "2026-12-15" }, adminId);
        // Raw notes only — never a pre-computed AI result (see the field doc
        // on DemoLead.requirementsNotes). "Analyze requirements" runs for real.
        if (l.requirementsNotes) await this.leadsRepo.setRequirementsNotes(lead.id, l.requirementsNotes);
      }

      // One full reservation -> signed contract -> payment plan chain, using a real
      // available unit from North Hills (first project seeded above).
      const northHills = projectId.get("north-hills")!;
      const availableUnits = await this.units.list({ projectId: northHills, status: "available" });
      if (availableUnits.length > 0) {
        const unit = availableUnits[0];
        const customer = await this.customers.create(
          { name: "Karim Abdelrahman", email: "karim.a@example.com", phone: "+201005550001", agentId: userId.get("ahmed")!, primaryProjectId: northHills },
          adminId,
        );
        const reservation = await this.reservations.create(
          { unitId: unit.id, customerId: customer.id, agentId: userId.get("ahmed")!, holdDays: 14, depositEgp: Math.round(unit.basePriceEgp * 0.05) },
          adminId,
        );
        const contract = await this.contracts.create(
          { reservationId: reservation.id, customerId: customer.id, unitId: unit.id, valueEgp: unit.basePriceEgp },
          adminId,
        );
        await this.contracts.sign(contract.id, adminId);
        await this.paymentPlans.create(
          { contractId: contract.id, downPaymentPct: 10, installmentCount: 16, cadence: "quarterly", startDate: now.toISOString().slice(0, 10) },
          adminId,
        );
      }
      // A second customer with no transactions yet, for a non-trivial customer list.
      await this.customers.create({ name: "Hala Mostafa", email: "hala.m@example.com", agentId: userId.get("sara")! }, adminId);

      // More reservation -> signed contract -> payment plan chains, spread across
      // the rest of the portfolio, each with a different collection progress —
      // so "Due vs. Collected by Project" and "Collection Rate" get several
      // differentiated bars instead of the one project above.
      for (const chain of DEMO_SALES_CHAINS) {
        const pid = projectId.get(chain.projectKey)!;
        const avail = await this.units.list({ projectId: pid, status: "available" });
        if (avail.length === 0) continue;
        const unit = avail[0];
        const customer = await this.customers.create(
          { name: chain.customerName, email: chain.customerEmail, agentId: userId.get(chain.agentKey)!, primaryProjectId: pid },
          adminId,
        );
        const reservation = await this.reservations.create(
          { unitId: unit.id, customerId: customer.id, agentId: userId.get(chain.agentKey)!, holdDays: 14, depositEgp: Math.round(unit.basePriceEgp * 0.05) },
          adminId,
        );
        const contract = await this.contracts.create(
          { reservationId: reservation.id, customerId: customer.id, unitId: unit.id, valueEgp: unit.basePriceEgp },
          adminId,
        );
        await this.contracts.sign(contract.id, adminId);
        const plan = await this.paymentPlans.create(
          { contractId: contract.id, downPaymentPct: chain.downPaymentPct, installmentCount: chain.installmentCount, cadence: chain.cadence, startDate: chain.startDate },
          adminId,
        );

        for (const inst of plan.installments.slice(0, chain.paidCount)) {
          await this.payments.record(
            { customerId: customer.id, unitId: unit.id, installmentId: inst.id, amountEgp: inst.amountEgp, method: "bank-transfer" },
            adminId,
          );
        }
        if (chain.overdueCount) {
          const overdueIds = plan.installments.slice(chain.paidCount, chain.paidCount + chain.overdueCount).map((i) => i.id);
          if (overdueIds.length > 0) {
            await realestateDb().updateTable("realestate_installments").set({ status: "overdue" }).where("id", "in", overdueIds).execute();
          }
        }
      }

      for (const a of DEMO_ACTIVITIES) {
        await this.activities.create({ type: a.type, subject: a.subject, agentId: userId.get(a.agentKey)!, outcome: a.outcome });
      }

      await this.tasks.create({ priority: "high", title: "Follow up with dormant leads", assigneeId: userId.get("ahmed")!, dueAt: new Date(now.getTime() + 2 * 86_400_000).toISOString() });
      await this.tasks.create({ priority: "medium", title: "Prepare North Hills handover pack", assigneeId: userId.get("youssef")!, dueAt: new Date(now.getTime() + 5 * 86_400_000).toISOString() });

      await this.approvals.create({ kind: "discount", subject: "6% discount on a Palm District unit", requestedBy: userId.get("mohamed")!, amountEgp: 300_000 });

      await this.workflows.create({
        name: "Contract approval",
        steps: [{ label: "Legal review" }, { label: "Finance sign-off" }, { label: "Commercial Director approval", assigneeId: adminId }],
      });

      // `InsightsRepository.create()` and the raw `realestateDb()` update below
      // are the only two write paths in the whole seeder that don't go through a
      // Service's own `uow.transaction()` — every other repo relies on that to
      // `SET LOCAL app.organization_id` for the RLS `tenant_isolation` policy.
      // Without an explicit transaction here, both inserts run outside any
      // transaction that has that session variable set, and Postgres rejects
      // them (`new row violates row-level security policy`) — which previously
      // crashed the seed mid-way (after projects/leads/etc. had already
      // committed) and left both insights and every project's velocity stuck at
      // their column defaults, silently, since the crash just looked like a
      // transient boot failure that a systemd restart "fixed" (by skipping the
      // now-idempotent-guarded reseed entirely).
      await unitOfWork.transaction(async () => {
        for (const i of DEMO_DASHBOARD_INSIGHTS) {
          await this.insights.create({ kind: "dashboard", tag: i.tag, confidence: i.confidence, text: i.text, detail: i.detail, cta: i.cta, targetRoute: i.targetRoute });
        }
        for (const i of DEMO_FEED_INSIGHTS) {
          await this.insights.create({ kind: "feed", tag: i.tag, confidence: i.confidence, text: i.text, detail: i.detail, cta: i.cta });
        }

        // `velocity_per_week` has no producer anywhere in the app (see
        // `DEMO_PROJECT_VELOCITY`'s own comment) — set it directly per project so
        // the dashboard's Sales Velocity chart isn't flat zero across the board.
        for (const [key, velocity] of Object.entries(DEMO_PROJECT_VELOCITY)) {
          const pid = projectId.get(key);
          if (!pid) continue;
          await realestateDb().updateTable("realestate_projects").set({ velocity_per_week: velocity.toFixed(2) }).where("id", "=", pid).execute();
        }
      });
    });

    log.info({ org: DEMO_SLUG, users: DEMO_TEAM.length, projects: DEMO_PROJECTS.length }, "demo data seeded");
  }
}
