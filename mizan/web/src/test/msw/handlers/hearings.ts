import { http, HttpResponse } from "msw";
import {
  CURRENT_USER_ID,
  clientName,
  db,
  nextId,
  userName,
  type HearingRow,
} from "../fixtures/db";

const find = (id: string) => db.hearings.find((h) => h.id === id);
const notFound = () =>
  HttpResponse.json({ code: "hearing.not_found", message: "Hearing not found." }, { status: 404 });

function view(h: HearingRow) {
  const m = db.matters.find((x) => x.id === h.matterId);
  return {
    id: h.id,
    matterId: h.matterId,
    matterTitle: m?.title ?? "—",
    matterReference: m?.reference ?? "—",
    clientName: m ? clientName(m.clientId) : "—",
    leadLawyer: m ? (userName(m.leadLawyerId) ?? "—") : "—",
    court: h.court,
    scheduledAt: h.scheduledAt,
    status: h.status,
    purpose: h.purpose,
    outcome: h.outcome,
  };
}

function log(action: string, id: string, label: string) {
  db.activity.unshift({
    id: nextId("act"),
    actorId: CURRENT_USER_ID,
    action,
    targetType: "hearing",
    targetId: id,
    targetLabel: label,
    at: new Date().toISOString(),
  });
}

export const hearingHandlers = [
  http.get("/api/hearings/summary", () => {
    const now = Date.now();
    const week = now + 7 * 86_400_000;
    const quarterAgo = now - 90 * 86_400_000;
    return HttpResponse.json({
      scheduled: db.hearings.filter((h) => h.status === "scheduled").length,
      next7: db.hearings.filter(
        (h) =>
          h.status === "scheduled" &&
          new Date(h.scheduledAt).getTime() >= now &&
          new Date(h.scheduledAt).getTime() <= week,
      ).length,
      awaitingDate: db.hearings.filter(
        (h) => h.status === "scheduled" && !h.court,
      ).length,
      adjournedQuarter: db.hearings.filter(
        (h) => h.status === "adjourned" && new Date(h.scheduledAt).getTime() >= quarterAgo,
      ).length,
    });
  }),

  http.get("/api/hearings", ({ request }) => {
    const url = new URL(request.url);
    const matterId = url.searchParams.get("matterId");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const scope = url.searchParams.get("scope"); // "upcoming" | "past"
    const now = Date.now();

    let rows = [...db.hearings];
    if (matterId) rows = rows.filter((h) => h.matterId === matterId);
    if (status && status !== "all") rows = rows.filter((h) => h.status === status);
    if (from) rows = rows.filter((h) => h.scheduledAt >= from);
    if (to) rows = rows.filter((h) => h.scheduledAt <= to);
    if (scope === "upcoming") rows = rows.filter((h) => new Date(h.scheduledAt).getTime() >= now);
    if (scope === "past") rows = rows.filter((h) => new Date(h.scheduledAt).getTime() < now);

    rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return HttpResponse.json({ items: rows.map(view), total: rows.length });
  }),

  http.post("/api/hearings", async ({ request }) => {
    const b = (await request.json()) as Partial<HearingRow>;
    const m = db.matters.find((x) => x.id === b.matterId);
    if (!m) return HttpResponse.json({ code: "matter.not_found", message: "Unknown matter." }, { status: 400 });
    const row: HearingRow = {
      id: nextId("hrg"),
      matterId: b.matterId!,
      court: b.court ?? m.court ?? "—",
      scheduledAt: b.scheduledAt ?? new Date().toISOString(),
      status: "scheduled",
      purpose: b.purpose ?? "Hearing",
      outcome: null,
    };
    db.hearings.push(row);
    log("hearing.scheduled", row.id, `${row.purpose} — ${m.title}`);
    return HttpResponse.json(view(row), { status: 201 });
  }),

  http.get("/api/hearings/:id", ({ params }) => {
    const h = find(params.id as string);
    return h ? HttpResponse.json(view(h)) : notFound();
  }),

  http.patch("/api/hearings/:id", async ({ params, request }) => {
    const h = find(params.id as string);
    if (!h) return notFound();
    const b = (await request.json()) as Partial<HearingRow>;
    Object.assign(h, {
      court: b.court ?? h.court,
      scheduledAt: b.scheduledAt ?? h.scheduledAt,
      purpose: b.purpose ?? h.purpose,
    });
    return HttpResponse.json(view(h));
  }),

  // Adjourn: close this session, open a new scheduled one (chained — decision from PLAN F7).
  http.post("/api/hearings/:id/adjourn", async ({ params, request }) => {
    const h = find(params.id as string);
    if (!h) return notFound();
    const b = (await request.json()) as { newDate: string; reason?: string };
    h.status = "adjourned";
    h.outcome = b.reason ?? "Adjourned.";
    const m = db.matters.find((x) => x.id === h.matterId);
    const next: HearingRow = {
      id: nextId("hrg"),
      matterId: h.matterId,
      court: h.court,
      scheduledAt: b.newDate,
      status: "scheduled",
      purpose: h.purpose,
      outcome: null,
    };
    db.hearings.push(next);
    log("hearing.adjourned", h.id, `${h.purpose} — ${m?.title ?? ""}`);
    return HttpResponse.json({ adjourned: view(h), next: view(next) });
  }),

  http.post("/api/hearings/:id/outcome", async ({ params, request }) => {
    const h = find(params.id as string);
    if (!h) return notFound();
    const b = (await request.json()) as { outcome: string };
    h.status = "decided";
    h.outcome = b.outcome;
    log("hearing.decided", h.id, h.purpose);
    return HttpResponse.json(view(h));
  }),
];
