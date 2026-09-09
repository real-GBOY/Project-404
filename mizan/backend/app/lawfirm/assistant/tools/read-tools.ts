import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { MattersService } from "@app/lawfirm/matters/matters-service.js";
import { HearingsService } from "@app/lawfirm/hearings/hearings-service.js";
import { TasksService } from "@app/lawfirm/tasks/tasks-service.js";
import { DocumentsService } from "@app/lawfirm/documents/documents-service.js";
import { BillingService } from "@app/lawfirm/billing/billing-service.js";
import { CalendarService } from "@app/lawfirm/calendar/calendar-service.js";
import { DashboardService } from "@app/lawfirm/dashboard/dashboard-service.js";
import type { AssistantTool, ToolContext } from "./tool.js";

const id = z.string().trim().min(1);

/** Cap list payloads so a broad query can't blow the context window. */
function capItems<T>(result: { items: T[]; total?: number }, limit = 25) {
  return {
    items: result.items.slice(0, limit),
    total: result.total ?? result.items.length,
    truncated: result.items.length > limit,
  };
}

/**
 * The read side of the Copilot's toolset. Every tool delegates to an existing
 * law-firm service — the same code path a Mizan screen uses — so RLS, tenant
 * scoping and shaping are inherited for free. The registry checks each tool's
 * declared permission before it runs.
 */
@Injectable()
export class ReadTools {
  constructor(
    private readonly clients: ClientsService,
    private readonly matters: MattersService,
    private readonly hearings: HearingsService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
    private readonly billing: BillingService,
    private readonly calendar: CalendarService,
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
          name: "get_client",
          description: "Get one client's profile, stats and billing roll-up by client id.",
          resource: "client",
          parameters: z.object({ clientId: id }),
        },
        (a) => this.clients.get(a.clientId),
      ),
      t(
        {
          name: "search_clients",
          description:
            "Search/list clients. Optional free-text query (name), status and type filters.",
          resource: "client",
          parameters: z.object({
            query: z.string().optional(),
            status: z.enum(["active", "archived", "all"]).optional(),
            type: z.enum(["company", "individual", "all"]).optional(),
          }),
        },
        async (a) =>
          capItems(await this.clients.list({ q: a.query, status: a.status, type: a.type })),
      ),
      t(
        {
          name: "get_matter",
          description: "Get one matter's detail (client, lead lawyer, status, child counts).",
          resource: "matter",
          parameters: z.object({ matterId: id }),
        },
        (a) => this.matters.get(a.matterId),
      ),
      t(
        {
          name: "search_matters",
          description: "Search/list matters. Optional query, status, client and practice area.",
          resource: "matter",
          parameters: z.object({
            query: z.string().optional(),
            status: z.enum(["open", "on_hold", "closed", "all"]).optional(),
            clientId: id.optional(),
            practiceArea: z.string().optional(),
          }),
        },
        async (a) =>
          capItems(
            await this.matters.list({
              q: a.query,
              status: a.status,
              clientId: a.clientId,
              practiceArea: a.practiceArea,
            }),
          ),
      ),
      t(
        {
          name: "get_matter_summary",
          description:
            "A rounded picture of one matter: detail, financials (billed/collected/outstanding) and recent activity.",
          resource: "matter",
          parameters: z.object({ matterId: id }),
        },
        async (a) => {
          const [detail, financials, activity] = await Promise.all([
            this.matters.get(a.matterId),
            this.matters.financials(a.matterId),
            this.matters.activityFeed(a.matterId),
          ]);
          return { detail, financials, recentActivity: activity.slice(0, 10) };
        },
      ),
      t(
        {
          name: "get_matter_activity",
          description: "The activity timeline for one matter (and its hearings).",
          resource: "matter",
          parameters: z.object({ matterId: id }),
        },
        async (a) => (await this.matters.activityFeed(a.matterId)).slice(0, 30),
      ),
      t(
        {
          name: "get_matter_hearings",
          description: "Hearings scheduled on one matter.",
          resource: "hearing",
          parameters: z.object({ matterId: id }),
        },
        async (a) => capItems(await this.hearings.list({ matterId: a.matterId })),
      ),
      t(
        {
          name: "get_matter_tasks",
          description: "Tasks on one matter.",
          resource: "task",
          parameters: z.object({ matterId: id }),
        },
        async (a, ctx) =>
          capItems(await this.tasks.list({ matterId: a.matterId, actorId: ctx.userId })),
      ),
      t(
        {
          name: "get_matter_documents",
          description: "Documents filed on one matter (metadata only, no file contents).",
          resource: "document",
          parameters: z.object({ matterId: id }),
        },
        async (a) => capItems(await this.documents.list({ matterId: a.matterId })),
      ),
      t(
        {
          name: "get_hearings",
          description:
            "Firm-wide hearings. Optional scope (upcoming/past), status and ISO date range.",
          resource: "hearing",
          parameters: z.object({
            scope: z.enum(["upcoming", "past"]).optional(),
            status: z.enum(["scheduled", "adjourned", "decided"]).optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          }),
        },
        async (a) =>
          capItems(
            await this.hearings.list({
              scope: a.scope,
              status: a.status,
              from: a.from,
              to: a.to,
            }),
          ),
      ),
      t(
        {
          name: "get_tasks",
          description:
            "Tasks. `mine` limits to the current user; `range` is today/week/overdue/all.",
          resource: "task",
          parameters: z.object({
            mine: z.boolean().optional(),
            status: z.enum(["todo", "in_progress", "done"]).optional(),
            range: z.enum(["today", "week", "overdue", "all"]).optional(),
          }),
        },
        async (a, ctx) =>
          capItems(
            await this.tasks.list({
              mine: a.mine,
              status: a.status,
              range: a.range,
              actorId: ctx.userId,
            }),
          ),
      ),
      t(
        {
          name: "get_calendar_events",
          description:
            "Everything on the calendar (hearings, deadlines, tasks, events) in an ISO date range.",
          resource: "calendar",
          parameters: z.object({ from: z.string().optional(), to: z.string().optional() }),
        },
        async (a) => {
          const r = await this.calendar.range({ from: a.from, to: a.to });
          return { items: r.items.slice(0, 40), total: r.items.length };
        },
      ),
      t(
        {
          name: "get_invoice",
          description: "One invoice with its lines, totals and payments, by invoice id.",
          resource: "invoice",
          parameters: z.object({ invoiceId: id }),
        },
        (a) => this.billing.getInvoice(a.invoiceId),
      ),
      t(
        {
          name: "get_client_invoices",
          description: "Invoices for one client. Optional status filter.",
          resource: "invoice",
          parameters: z.object({
            clientId: id,
            status: z.enum(["draft", "issued", "sent", "paid", "void", "all"]).optional(),
          }),
        },
        async (a) => capItems(await this.billing.listInvoices(a.status, a.clientId)),
      ),
      t(
        {
          name: "get_invoices",
          description:
            "Firm-wide invoices. Optional status filter (use 'sent'/'issued' then check dueAt for overdue).",
          resource: "invoice",
          parameters: z.object({
            status: z.enum(["draft", "issued", "sent", "paid", "void", "all"]).optional(),
          }),
        },
        async (a) => capItems(await this.billing.listInvoices(a.status)),
      ),
      t(
        {
          name: "get_payments",
          description: "Recorded payments across the firm.",
          resource: "payment",
          parameters: z.object({}),
        },
        async () => capItems(await this.billing.listPayments()),
      ),
      t(
        {
          name: "get_expenses",
          description: "Expenses/disbursements. Optional status filter.",
          resource: "expense",
          parameters: z.object({
            status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
          }),
        },
        async (a) => capItems(await this.billing.listExpenses(a.status)),
      ),
      t(
        {
          name: "get_dashboard_summary",
          description:
            "The firm dashboard: KPIs, upcoming hearings, urgent deadlines, billing roll-up, my tasks, recent activity.",
          resource: "dashboard",
          parameters: z.object({}),
        },
        async () => {
          const d = await this.dashboard.data();
          return {
            kpis: d.kpis,
            alert: d.alert,
            upcomingHearings: d.upcomingHearings,
            urgentDeadlines: d.urgentDeadlines,
            billing: d.billing,
            myTasks: d.myTasks,
            recentActivity: d.recentActivity,
          };
        },
      ),
    ];
  }
}
