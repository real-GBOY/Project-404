import { http, HttpResponse } from "msw";
import type { Money } from "@/types/api";
import type {
  DashboardData,
  DashboardDocument,
} from "@/features/dashboard/types/dashboard";
import {
  CURRENT_USER_ID,
  db,
  invoiceTotals,
  matterRef,
  matterTitle,
  userName,
} from "../fixtures/db";

function byCurrency(entries: { currency: string; amount: number }[]): Money[] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => ({ currency, amount: String(Math.round(amount)) }));
}

const ACTIVITY_ICON: Record<string, string> = {
  "matter.update_added": "edit_note",
  "matter.opened": "gavel",
  "matter.assigned": "person_add",
  "matter.closed": "task_alt",
  "document.uploaded": "upload_file",
  "hearing.scheduled": "gavel",
  "hearing.adjourned": "gavel",
  "payment.recorded": "receipt_long",
  "invoice.sent": "receipt_long",
  "task.completed": "task_alt",
  "task.assigned": "person_add",
};

export const dashboardHandlers = [
  http.get("/api/dashboard", () => {
    const now = Date.now();
    const weekOut = now + 7 * 86_400_000;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(monthStart.getFullYear(), 0, 1).getTime();

    const openMatters = db.matters.filter((m) => m.status !== "closed");
    const openedThisMonth = db.matters.filter(
      (m) => new Date(m.openedAt).getTime() >= monthStart.getTime(),
    ).length;
    const closedYtd = db.matters.filter(
      (m) => m.closedAt && new Date(m.closedAt).getTime() >= yearStart,
    ).length;

    const monthHearings = db.hearings.filter(
      (h) => new Date(h.scheduledAt).getTime() >= monthStart.getTime(),
    );
    const hearingsThisMonth = monthHearings.length;
    const hearingsNext7 = db.hearings.filter(
      (h) =>
        h.status === "scheduled" &&
        new Date(h.scheduledAt).getTime() >= now &&
        new Date(h.scheduledAt).getTime() <= weekOut,
    ).length;
    const adjournedThisMonth = monthHearings.filter((h) => h.status === "adjourned").length;

    // Unbilled time — in-progress + open tasks with an estimate proxy (2h each),
    // valued at a blended EGP rate. Synthetic but stable for the prototype.
    const openTaskCount = db.tasks.filter((t) => t.status !== "done").length;
    const unbilledHours = Math.round(openTaskCount * 12.4 * 10) / 10;
    const unbilledValue: Money[] = [
      { currency: "EGP", amount: String(Math.round(unbilledHours * 6000)) },
    ];

    const outstandingInvoices = db.invoices.filter(
      (i) => i.status === "sent" || i.status === "issued",
    );
    const outstanding = byCurrency(
      outstandingInvoices.map((i) => ({ currency: i.currency, amount: invoiceTotals(i).balance })),
    );
    const overdue = outstandingInvoices.filter(
      (i) => i.dueAt && new Date(i.dueAt).getTime() < now,
    );
    const overdueAmount = byCurrency(
      overdue.map((i) => ({ currency: i.currency, amount: invoiceTotals(i).balance })),
    );

    const hearingStatus = (s: string): "confirmed" | "awaiting_court" | "adjourned" =>
      s === "adjourned" ? "adjourned" : s === "scheduled" ? "confirmed" : "awaiting_court";

    const upcomingHearings = db.hearings
      .filter((h) => h.status !== "decided" && new Date(h.scheduledAt).getTime() >= now - 3 * 86_400_000)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 5)
      .map((h) => ({
        id: h.id,
        matterId: h.matterId,
        matterNumber: matterRef(h.matterId) ?? "—",
        matterTitle: matterTitle(h.matterId) ?? "—",
        court: h.court,
        scheduledAt: h.scheduledAt,
        leadLawyer:
          userName(db.matters.find((m) => m.id === h.matterId)?.leadLawyerId ?? null) ?? "—",
        status: hearingStatus(h.status),
      }));

    const urgentDeadlines = db.events
      .filter((e) => e.kind === "court_filing" || e.kind === "reminder")
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 4)
      .map((e) => {
        const days = (new Date(e.startAt).getTime() - now) / 86_400_000;
        return {
          id: e.id,
          matterId: e.matterId ?? "",
          matterNumber: matterRef(e.matterId) ?? "—",
          matterTitle: matterTitle(e.matterId) ?? "—",
          title: e.title,
          owner: userName(e.ownerId) ?? "—",
          dueAt: e.startAt,
          severity: (days <= 3 ? "critical" : "warning") as "critical" | "warning",
        };
      });

    const areaCounts = new Map<string, number>();
    for (const m of openMatters)
      areaCounts.set(m.practiceArea, (areaCounts.get(m.practiceArea) ?? 0) + 1);
    const practiceAreas = [...areaCounts.entries()]
      .map(([area, matters]) => ({ area, matters }))
      .sort((a, b) => b.matters - a.matters);

    // Billing vs collections — real YTD from the fixture + a stable 6-month series.
    const paidYtd = db.payments.filter((p) => new Date(p.receivedAt).getTime() >= yearStart);
    const billedYtdEntries = db.invoices
      .filter((i) => i.issuedAt && new Date(i.issuedAt).getTime() >= yearStart)
      .map((i) => ({ currency: i.currency, amount: invoiceTotals(i).total }));
    const billedYtd = byCurrency(billedYtdEntries);
    const collectedYtd = byCurrency(
      paidYtd.map((p) => ({ currency: p.currency, amount: p.amount })),
    );
    const billedTotal = billedYtdEntries.reduce((s, e) => s + e.amount, 0);
    const collectedTotal = paidYtd.reduce((s, p) => s + p.amount, 0);
    const collectionRate = billedTotal
      ? Math.round((collectedTotal / billedTotal) * 100)
      : 0;

    // Trailing 6 calendar months (oldest → newest), EGP only — matches
    // DashboardService.data()'s `billing.series`.
    const nowDate = new Date(now);
    const series = Array.from({ length: 6 }, (_, i) => {
      const from = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - (5 - i), 1));
      const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
      const within = (value: string) => {
        const t = new Date(value);
        return t >= from && t < to;
      };
      const billed = db.invoices
        .filter((inv) => inv.currency === "EGP" && inv.issuedAt && within(inv.issuedAt))
        .reduce((s, inv) => s + invoiceTotals(inv).total, 0);
      const collected = db.payments
        .filter((p) => p.currency === "EGP" && within(p.receivedAt))
        .reduce((s, p) => s + p.amount, 0);
      return {
        month: from.toISOString().slice(0, 7),
        billed: Math.round(billed),
        collected: Math.round(collected),
        currency: "EGP",
      };
    });

    const priorityFor = (p: string): "low" | "normal" | "high" =>
      p === "high" ? "high" : p === "low" ? "low" : "normal";

    const myTasks = db.tasks
      .filter((t) => t.assigneeId === CURRENT_USER_ID && t.status !== "done")
      .sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        matterTitle: matterTitle(t.matterId),
        assignee: userName(t.assigneeId) ?? "—",
        dueAt: t.dueAt,
        priority: priorityFor(t.priority),
      }));

    const docStatus = (d: { status: string; category: string }): DashboardDocument["status"] =>
      d.category.toLowerCase().includes("authority") || d.category.toLowerCase().includes("power")
        ? "expiring"
        : d.status === "draft"
          ? "awaiting_review"
          : "in_review";

    const reviewDocuments = db.documents
      .filter((d) => d.status === "draft" || d.category.toLowerCase().includes("power"))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .slice(0, 4)
      .map((d) => ({
        id: d.id,
        name: d.name,
        matterTitle: matterTitle(d.matterId) ?? "—",
        uploadedAt: d.uploadedAt,
        status: docStatus(d),
      }));

    const recentActivity = [...db.activity]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        actor: userName(a.actorId) ?? "—",
        action: a.action,
        target: a.targetLabel,
        at: a.at,
        icon: ACTIVITY_ICON[a.action] ?? "history",
      }));

    const alert =
      urgentDeadlines.filter((d) => d.severity === "critical").length > 0
        ? {
            title: "critical_deadlines",
            detail: urgentDeadlines
              .filter((d) => d.severity === "critical")
              .map((d) => d.title)
              .join(" · "),
          }
        : null;

    return HttpResponse.json<DashboardData>({
      kpis: {
        activeMatters: openMatters.length,
        openedThisMonth,
        closedYtd,
        hearingsThisMonth,
        hearingsNext7,
        adjournedThisMonth,
        unbilledHours,
        unbilledValue,
        outstanding,
        overdueInvoices: overdue.length,
        overdueAmount,
      },
      alert,
      upcomingHearings,
      urgentDeadlines,
      practiceAreas,
      billing: { billedYtd, collectedYtd, collectionRate, series },
      myTasks,
      reviewDocuments,
      recentActivity,
    });
  }),
];
