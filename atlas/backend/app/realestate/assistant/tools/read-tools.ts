import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { LeadsService } from "@atlas/realestate/crm/leads-service.js";
import { CustomersService } from "@atlas/realestate/crm/customers-service.js";
import { ActivitiesService } from "@atlas/realestate/crm/activities-service.js";
import { ProjectsService } from "@atlas/realestate/properties/projects-service.js";
import { UnitsService } from "@atlas/realestate/properties/units-service.js";
import { ReservationsService } from "@atlas/realestate/sales/reservations-service.js";
import { ContractsService } from "@atlas/realestate/sales/contracts-service.js";
import { PaymentPlansService } from "@atlas/realestate/sales/payment-plans-service.js";
import { PaymentsService } from "@atlas/realestate/finance/payments-service.js";
import { TasksService } from "@atlas/realestate/operations/tasks-service.js";
import { DashboardService } from "@atlas/realestate/dashboard/dashboard-service.js";
import type { AssistantTool, ToolContext } from "./tool.js";

const id = z.string().trim().min(1);

/** Cap list payloads so a broad query can't blow the context window. */
function capArray<T>(items: T[], limit = 25) {
  return { items: items.slice(0, limit), total: items.length, truncated: items.length > limit };
}

/**
 * The read side of the Copilot's toolset. Every tool delegates to an existing
 * real-estate service — the same code path an Atlas screen uses — so RLS,
 * tenant scoping and shaping are inherited for free. The registry checks each
 * tool's declared permission before it runs.
 *
 * Ported from `mizan/backend/app/lawfirm/assistant/tools/read-tools.ts`,
 * re-mapped onto Atlas's own domains.
 */
@Injectable()
export class ReadTools {
  constructor(
    private readonly leads: LeadsService,
    private readonly customers: CustomersService,
    private readonly activities: ActivitiesService,
    private readonly projects: ProjectsService,
    private readonly units: UnitsService,
    private readonly reservations: ReservationsService,
    private readonly contracts: ContractsService,
    private readonly paymentPlans: PaymentPlansService,
    private readonly payments: PaymentsService,
    private readonly tasks: TasksService,
    private readonly dashboard: DashboardService,
  ) {}

  tools(): AssistantTool[] {
    const t = <S extends z.ZodTypeAny>(
      def: {
        name: string;
        description: string;
        resource: string;
        parameters: S;
      },
      execute: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>,
    ): AssistantTool<S> => ({
      name: def.name,
      description: def.description,
      permission: { action: "read", resource: def.resource },
      parameters: def.parameters,
      execute,
    });

    return [
      t(
        {
          name: "get_lead",
          description: "Get one lead's full detail by id (source, agent, stage, score, value, interest).",
          resource: "lead",
          parameters: z.object({ leadId: id }),
        },
        (a) => this.leads.get(a.leadId),
      ),
      t(
        {
          name: "search_leads",
          description:
            "Search/list leads. Optional status, pipeline stage, agent, and a deals-only filter (leads tracked as opportunities).",
          resource: "lead",
          parameters: z.object({
            status: z.enum(["new", "qualified", "contacted", "viewing", "negotiation", "lost"]).optional(),
            stage: z
              .enum(["new", "qualified", "contacted", "viewing", "negotiation", "reserved", "contracted", "sold", "lost"])
              .optional(),
            agentId: id.optional(),
            dealsOnly: z.boolean().optional(),
          }),
        },
        async (a) => capArray(await this.leads.list(a)),
      ),
      t(
        {
          name: "get_customer",
          description: "Get one customer's profile by id (units owned, portfolio value, collected-to-date).",
          resource: "customer",
          parameters: z.object({ customerId: id }),
        },
        (a) => this.customers.get(a.customerId),
      ),
      t(
        {
          name: "search_customers",
          description: "List all customers with their unit/portfolio roll-up.",
          resource: "customer",
          parameters: z.object({}),
        },
        async () => capArray(await this.customers.list()),
      ),
      t(
        {
          name: "get_activities",
          description: "The CRM activity log (calls, meetings, emails, notes). Optionally filtered to one lead or customer.",
          resource: "activity",
          parameters: z.object({
            relatedType: z.enum(["lead", "customer"]).optional(),
            relatedId: id.optional(),
          }),
        },
        async (a) => capArray(await this.activities.list(a.relatedType, a.relatedId), 30),
      ),
      t(
        {
          name: "get_project",
          description: "Get one project's detail by id (units, sold/reserved/available counts, revenue, sell-through, velocity).",
          resource: "project",
          parameters: z.object({ projectId: id }),
        },
        (a) => this.projects.get(a.projectId),
      ),
      t(
        {
          name: "search_projects",
          description: "List every project in the portfolio with its rollups.",
          resource: "project",
          parameters: z.object({}),
        },
        async () => capArray(await this.projects.list()),
      ),
      t(
        {
          name: "get_unit",
          description: "Get one unit's detail by id (status, price, floor, type, project/building).",
          resource: "unit",
          parameters: z.object({ unitId: id }),
        },
        (a) => this.units.get(a.unitId),
      ),
      t(
        {
          name: "search_units",
          description:
            "Search the unit inventory. Optional project, building and status filters (available/reserved/sold/on-hold/unavailable).",
          resource: "unit",
          parameters: z.object({
            projectId: id.optional(),
            buildingId: id.optional(),
            status: z.enum(["available", "reserved", "sold", "on-hold", "unavailable"]).optional(),
          }),
        },
        async (a) => capArray(await this.units.list(a), 40),
      ),
      t(
        {
          name: "get_unit_availability",
          description: "Portfolio-wide unit availability, grouped by project and unit type.",
          resource: "unit",
          parameters: z.object({}),
        },
        () => this.units.availability(),
      ),
      t(
        {
          name: "get_reservation",
          description: "Get one reservation's detail by id.",
          resource: "reservation",
          parameters: z.object({ reservationId: id }),
        },
        (a) => this.reservations.get(a.reservationId),
      ),
      t(
        {
          name: "search_reservations",
          description: "List reservations. Optional status (active/expiring/expired/converted).",
          resource: "reservation",
          parameters: z.object({ status: z.enum(["active", "expiring", "expired", "converted"]).optional() }),
        },
        async (a) => capArray(await this.reservations.list(a.status)),
      ),
      t(
        {
          name: "get_contract",
          description: "Get one contract's detail by id.",
          resource: "contract",
          parameters: z.object({ contractId: id }),
        },
        (a) => this.contracts.get(a.contractId),
      ),
      t(
        {
          name: "search_contracts",
          description: "List contracts. Optional status (draft/awaiting-approval/signed).",
          resource: "contract",
          parameters: z.object({ status: z.enum(["draft", "awaiting-approval", "signed"]).optional() }),
        },
        async (a) => capArray(await this.contracts.list(a.status)),
      ),
      t(
        {
          name: "get_payment_plan",
          description: "Get one contract's payment plan and its full installment schedule.",
          resource: "payment_plan",
          parameters: z.object({ contractId: id }),
        },
        (a) => this.paymentPlans.getForContract(a.contractId),
      ),
      t(
        {
          name: "get_installments",
          description: "Firm-wide installments. Optional status (pending/partial/paid/overdue).",
          resource: "payment_plan",
          parameters: z.object({ status: z.enum(["pending", "partial", "paid", "overdue"]).optional() }),
        },
        async (a) => capArray(await this.paymentPlans.listInstallments(a.status), 40),
      ),
      t(
        {
          name: "get_collections",
          description: "Per-project collections rollup: due, collected, overdue, accounts, collection rate.",
          resource: "payment",
          parameters: z.object({}),
        },
        () => this.payments.collections(),
      ),
      t(
        {
          name: "get_outstanding",
          description: "Accounts with an overdue or past-due-pending installment, with aging in days.",
          resource: "payment",
          parameters: z.object({}),
        },
        async () => capArray(await this.payments.outstanding(), 30),
      ),
      t(
        {
          name: "get_tasks",
          description: "Tasks. Optional assignee and status (open/in-progress/done) filters.",
          resource: "task",
          parameters: z.object({
            assigneeId: id.optional(),
            status: z.enum(["open", "in-progress", "done"]).optional(),
          }),
        },
        async (a) => capArray(await this.tasks.list(a.assigneeId, a.status)),
      ),
      t(
        {
          name: "get_dashboard_summary",
          description:
            "The executive dashboard: portfolio KPIs, project rollups, inventory by type, lead funnel, recent activity, collections by project.",
          resource: "dashboard",
          parameters: z.object({}),
        },
        () => this.dashboard.summary(),
      ),
    ];
  }
}
