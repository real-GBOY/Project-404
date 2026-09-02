import { http, HttpResponse } from "msw";
import type { Money } from "@/types/api";
import type { DashboardData } from "@/features/dashboard/types/dashboard";
import { CURRENT_USER_ID, db, invoiceTotals, matterTitle, userName } from "../fixtures/db";

function byCurrency(entries: { currency: string; amount: number }[]): Money[] {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount: String(amount) }));
}

export const dashboardHandlers = [
  http.get("/api/dashboard", () => {
    const now = Date.now();
    const weekOut = now + 7 * 86_400_000;

    const openMatters = db.matters.filter((m) => m.status !== "closed");

    const outstanding = db.invoices
      .filter((i) => i.status === "sent" || i.status === "issued")
      .map((i) => ({ currency: i.currency, amount: invoiceTotals(i).balance }));

    const monthAgo = now - 30 * 86_400_000;
    const collected = db.payments
      .filter((p) => new Date(p.receivedAt).getTime() >= monthAgo)
      .map((p) => ({ currency: p.currency, amount: p.amount }));

    const upcomingHearings = db.hearings
      .filter((h) => h.status === "scheduled" && new Date(h.scheduledAt).getTime() >= now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 5)
      .map((h) => ({
        id: h.id,
        matterId: h.matterId,
        matterTitle: matterTitle(h.matterId) ?? "—",
        court: h.court,
        scheduledAt: h.scheduledAt,
      }));

    const urgentDeadlines = db.events
      .filter((e) => (e.kind === "court_filing" || e.kind === "reminder"))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        matterId: e.matterId ?? "",
        matterTitle: matterTitle(e.matterId) ?? "—",
        title: e.title,
        dueAt: e.startAt,
      }));

    const areaCounts = new Map<string, number>();
    for (const m of openMatters) areaCounts.set(m.practiceArea, (areaCounts.get(m.practiceArea) ?? 0) + 1);
    const practiceAreas = [...areaCounts.entries()]
      .map(([area, matters]) => ({ area, matters }))
      .sort((a, b) => b.matters - a.matters);

    // Billing vs collections, EGP only, last 6 months (synthetic but stable).
    const billingSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (5 - i), 1);
      const month = d.toISOString().slice(0, 7);
      const base = 320_000 + i * 28_000;
      return {
        month,
        billed: base + (i % 2 === 0 ? 40_000 : -10_000),
        collected: Math.round(base * (0.7 + i * 0.03)),
        currency: "EGP",
      };
    });

    const myTasks = db.tasks
      .filter((t) => t.assigneeId === CURRENT_USER_ID && t.status !== "done")
      .sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"))
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        matterTitle: matterTitle(t.matterId),
        dueAt: t.dueAt,
        priority: t.priority,
      }));

    const reviewDocuments = db.documents
      .filter((d) => d.status === "draft")
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        name: d.name,
        matterTitle: matterTitle(d.matterId) ?? "—",
        uploadedAt: d.uploadedAt,
      }));

    const recentActivity = [...db.activity]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        actor: userName(a.actorId) ?? "—",
        action: a.action,
        target: a.targetLabel,
        at: a.at,
      }));

    return HttpResponse.json<DashboardData>({
      kpis: {
        activeMatters: openMatters.length,
        openTasks: db.tasks.filter((t) => t.status !== "done").length,
        hearingsThisWeek: db.hearings.filter(
          (h) =>
            h.status === "scheduled" &&
            new Date(h.scheduledAt).getTime() >= now &&
            new Date(h.scheduledAt).getTime() <= weekOut,
        ).length,
        outstanding: byCurrency(outstanding),
        collectedThisMonth: byCurrency(collected),
      },
      upcomingHearings,
      urgentDeadlines,
      practiceAreas,
      billingSeries,
      myTasks,
      reviewDocuments,
      recentActivity,
    });
  }),
];
