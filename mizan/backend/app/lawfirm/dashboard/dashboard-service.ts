import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { BillingRepository } from "@app/lawfirm/billing/billing-repository.js";
import { invoiceTotals } from "@app/lawfirm/billing/invoice.domain.js";
import { CalendarRepository } from "@app/lawfirm/calendar/calendar-repository.js";
import { DocumentsRepository } from "@app/lawfirm/documents/documents-repository.js";
import { HearingsRepository } from "@app/lawfirm/hearings/hearings-repository.js";
import { MattersRepository } from "@app/lawfirm/matters/matters-repository.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { moneyList, type Money } from "@app/lawfirm/shared/money.js";
import { TasksRepository } from "@app/lawfirm/tasks/tasks-repository.js";

const DAY = 86_400_000;

const ACTIVITY_ICON: Record<string, string> = {
  "matter.update_added": "edit_note",
  "matter.opened": "gavel",
  "matter.assigned": "person_add",
  "matter.closed": "task_alt",
  "document.uploaded": "upload_file",
  "hearing.scheduled": "gavel",
  "hearing.adjourned": "gavel",
  "hearing.decided": "gavel",
  "payment.recorded": "receipt_long",
  "invoice.sent": "receipt_long",
  "task.completed": "task_alt",
  "task.assigned": "person_add",
  "client.created": "person_add",
  "client.archived": "archive",
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly matters: MattersRepository,
    private readonly hearings: HearingsRepository,
    private readonly tasks: TasksRepository,
    private readonly documents: DocumentsRepository,
    private readonly billing: BillingRepository,
    private readonly calendar: CalendarRepository,
    private readonly activity: ActivityService,
    private readonly directory: LawfirmDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async data() {
    return readInTenant(async () => {
      const now = this.clock.now();
      const nowMs = now.getTime();
      const weekOut = nowMs + 7 * DAY;
      const monthStart = new Date(now);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const yearStart = new Date(monthStart.getFullYear(), 0, 1);

      const [allMatters, allHearings, allTasks, allDocs, invoices, payments, events, recent] =
        await Promise.all([
          this.matters.allForSummary(),
          this.hearings.all(),
          this.tasks.all(),
          this.documents.all(),
          this.billing.invoices(),
          this.billing.payments(),
          this.calendar.events(),
          this.activity.recent(5),
        ]);

      const matterInfo = new Map(
        allMatters.map((m) => [
          m.id,
          {
            number: m.reference,
            title: m.title,
            leadLawyerId: m.leadLawyerId,
            practiceArea: m.practiceArea,
            court: m.court,
          },
        ]),
      );
      const paidByInvoice = new Map<string, number>();
      for (const p of payments)
        paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + p.amount);
      const totalsFor = (i: (typeof invoices)[number]) =>
        invoiceTotals(i, paidByInvoice.get(i.id) ?? 0);

      const openMatters = allMatters.filter((m) => m.status !== "closed");
      const monthHearings = allHearings.filter((h) => h.scheduledAt >= monthStart);
      const outstandingInvoices = invoices.filter(
        (i) => i.status === "sent" || i.status === "issued",
      );
      const outstanding = moneyList(
        outstandingInvoices.map((i) => ({ currency: i.currency, amount: totalsFor(i).balance })),
      );
      const overdue = outstandingInvoices.filter((i) => i.dueAt && i.dueAt < now);
      const overdueAmount = moneyList(
        overdue.map((i) => ({ currency: i.currency, amount: totalsFor(i).balance })),
      );

      const hearingStatus = (s: string): "confirmed" | "awaiting_court" | "adjourned" =>
        s === "adjourned" ? "adjourned" : s === "scheduled" ? "confirmed" : "awaiting_court";

      const upcomingHearings = await Promise.all(
        allHearings
          .filter((h) => h.status !== "decided" && h.scheduledAt.getTime() >= nowMs - 3 * DAY)
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          .slice(0, 5)
          .map(async (h) => {
            const mi = matterInfo.get(h.matterId);
            return {
              id: h.id,
              matterId: h.matterId,
              matterNumber: mi?.number ?? "—",
              matterTitle: mi?.title ?? "—",
              court: h.court,
              scheduledAt: h.scheduledAt.toISOString(),
              leadLawyer: (await this.directory.userName(mi?.leadLawyerId)) ?? "—",
              status: hearingStatus(h.status),
            };
          }),
      );

      const urgentDeadlines = await Promise.all(
        events
          .filter((e) => e.kind === "court_filing" || e.kind === "reminder")
          .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
          .slice(0, 4)
          .map(async (e) => {
            const days = (e.startAt.getTime() - nowMs) / DAY;
            const mi = e.matterId ? matterInfo.get(e.matterId) : null;
            return {
              id: e.id,
              matterId: e.matterId ?? "",
              matterNumber: mi?.number ?? "—",
              matterTitle: mi?.title ?? "—",
              title: e.title,
              owner: (await this.directory.userName(e.ownerId)) ?? "—",
              dueAt: e.startAt.toISOString(),
              severity: (days <= 3 ? "critical" : "warning") as "critical" | "warning",
            };
          }),
      );

      const areaCounts = new Map<string, number>();
      for (const m of openMatters)
        areaCounts.set(m.practiceArea, (areaCounts.get(m.practiceArea) ?? 0) + 1);
      const practiceAreas = [...areaCounts.entries()]
        .map(([area, matters]) => ({ area, matters }))
        .sort((a, b) => b.matters - a.matters);

      const billedYtdEntries = invoices
        .filter((i) => i.issuedAt && i.issuedAt >= yearStart)
        .map((i) => ({ currency: i.currency, amount: totalsFor(i).total }));
      const paidYtd = payments.filter((p) => p.receivedAt >= yearStart);
      const billedTotal = billedYtdEntries.reduce((s, e) => s + e.amount, 0);
      const collectedTotal = paidYtd.reduce((s, p) => s + p.amount, 0);
      const collectionRate = billedTotal ? Math.round((collectedTotal / billedTotal) * 100) : 0;

      // Billing vs collections — trailing 6 calendar months (oldest → newest),
      // EGP only (the chart is single-scale, single-currency). Stays empty until
      // the firm has issued an invoice or taken a payment.
      const CHART_CURRENCY = "EGP";
      const series =
        invoices.some((i) => i.issuedAt) || payments.length > 0
          ? Array.from({ length: 6 }, (_, i) => {
              const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
              const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
              const within = (d: Date) => d >= from && d < to;
              const billed = invoices
                .filter(
                  (iv) => iv.currency === CHART_CURRENCY && iv.issuedAt && within(iv.issuedAt),
                )
                .reduce((s, iv) => s + totalsFor(iv).total, 0);
              const collected = payments
                .filter((p) => p.currency === CHART_CURRENCY && within(p.receivedAt))
                .reduce((s, p) => s + p.amount, 0);
              return {
                month: from.toISOString().slice(0, 7),
                billed: Math.round(billed),
                collected: Math.round(collected),
                currency: CHART_CURRENCY,
              };
            })
          : [];

      const priorityFor = (p: string): "low" | "normal" | "high" =>
        p === "high" ? "high" : p === "low" ? "low" : "normal";

      const myTasks = await Promise.all(
        allTasks
          .filter((t) => t.status !== "done")
          .sort((a, b) => (a.dueAt?.getTime() ?? 9e15) - (b.dueAt?.getTime() ?? 9e15))
          .slice(0, 6)
          .map(async (t) => ({
            id: t.id,
            title: t.title,
            matterTitle: t.matterId ? (matterInfo.get(t.matterId)?.title ?? null) : null,
            assignee: (await this.directory.userName(t.assigneeId)) ?? "—",
            dueAt: t.dueAt?.toISOString() ?? null,
            priority: priorityFor(t.priority),
          })),
      );

      const docStatus = (d: {
        status: string;
        category: string;
      }): "awaiting_review" | "expiring" | "in_review" =>
        /power|authority/i.test(d.category)
          ? "expiring"
          : d.status === "draft"
            ? "awaiting_review"
            : "in_review";
      const reviewDocuments = allDocs
        .filter((d) => d.status === "draft" || /power/i.test(d.category))
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .slice(0, 4)
        .map((d) => ({
          id: d.id,
          name: d.name,
          matterTitle: d.matterId ? (matterInfo.get(d.matterId)?.title ?? "—") : "—",
          uploadedAt: d.uploadedAt.toISOString(),
          status: docStatus(d),
        }));

      const recentActivity = (await this.activity.toRows(recent)).map((a) => ({
        ...a,
        icon: ACTIVITY_ICON[a.action] ?? "history",
      }));

      const critical = urgentDeadlines.filter((d) => d.severity === "critical");
      const alert =
        critical.length > 0
          ? { title: "critical_deadlines", detail: critical.map((d) => d.title).join(" · ") }
          : null;

      const emptyMoney: Money[] = [];
      return {
        kpis: {
          activeMatters: openMatters.length,
          openedThisMonth: allMatters.filter((m) => m.openedAt >= monthStart).length,
          closedYtd: allMatters.filter((m) => m.closedAt && m.closedAt >= yearStart).length,
          hearingsThisMonth: monthHearings.length,
          hearingsNext7: allHearings.filter(
            (h) =>
              h.status === "scheduled" &&
              h.scheduledAt.getTime() >= nowMs &&
              h.scheduledAt.getTime() <= weekOut,
          ).length,
          adjournedThisMonth: monthHearings.filter((h) => h.status === "adjourned").length,
          unbilledHours: 0,
          unbilledValue: emptyMoney,
          outstanding,
          overdueInvoices: overdue.length,
          overdueAmount,
        },
        alert,
        upcomingHearings,
        urgentDeadlines,
        practiceAreas,
        billing: {
          billedYtd: moneyList(billedYtdEntries),
          collectedYtd: moneyList(paidYtd.map((p) => ({ currency: p.currency, amount: p.amount }))),
          collectionRate,
          series,
        },
        myTasks,
        reviewDocuments,
        recentActivity,
      };
    });
  }
}
