import { http, HttpResponse } from "msw";
import type { Money, Paginated } from "@/types/api";
import { CURRENT_USER_ID, clientName, db, invoiceTotals, nextId, userName, type MatterRow } from "../fixtures/db";

const PAGE_SIZE = 10;
const notFound = () =>
  HttpResponse.json({ code: "matter.not_found", message: "Matter not found." }, { status: 404 });
const find = (id: string) => db.matters.find((m) => m.id === id);

function money(entries: { currency: string; amount: number }[]): Money[] {
  const map = new Map<string, number>();
  for (const e of entries) if (e.amount) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount: String(amount) }));
}

function nextHearing(matterId: string): string | null {
  const now = Date.now();
  return (
    db.hearings
      .filter((h) => h.matterId === matterId && h.status === "scheduled" && new Date(h.scheduledAt).getTime() >= now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]?.scheduledAt ?? null
  );
}

const listItem = (m: MatterRow) => ({
  id: m.id,
  reference: m.reference,
  title: m.title,
  clientId: m.clientId,
  clientName: clientName(m.clientId),
  practiceArea: m.practiceArea,
  status: m.status,
  leadLawyer: userName(m.leadLawyerId) ?? "—",
  openedAt: m.openedAt,
  nextHearingAt: nextHearing(m.id),
  openTasks: db.tasks.filter((k) => k.matterId === m.id && k.status !== "done").length,
});

function detail(m: MatterRow) {
  const parts = db.participants.filter((p) => p.matterId === m.id);
  return {
    id: m.id,
    reference: m.reference,
    title: m.title,
    description: m.description,
    clientId: m.clientId,
    clientName: clientName(m.clientId),
    practiceArea: m.practiceArea,
    status: m.status,
    court: m.court,
    leadLawyer: { id: m.leadLawyerId, name: userName(m.leadLawyerId) ?? "—" },
    openedAt: m.openedAt,
    closedAt: m.closedAt,
    participants: parts.map((p) => ({ id: p.id, userId: p.userId, name: userName(p.userId) ?? "—", role: p.role })),
    counts: {
      hearings: db.hearings.filter((h) => h.matterId === m.id).length,
      tasks: db.tasks.filter((k) => k.matterId === m.id).length,
      openTasks: db.tasks.filter((k) => k.matterId === m.id && k.status !== "done").length,
      documents: db.documents.filter((d) => d.matterId === m.id).length,
      notes: db.notes.filter((n) => n.matterId === m.id).length,
    },
  };
}

function logActivity(action: string, targetId: string, label: string) {
  db.activity.unshift({
    id: nextId("act"),
    actorId: CURRENT_USER_ID,
    action,
    targetType: "matter",
    targetId,
    targetLabel: label,
    at: new Date().toISOString(),
  });
}

export const matterHandlers = [
  http.get("/api/matters/form-options", () =>
    HttpResponse.json({
      clients: db.clients
        .filter((c) => c.status === "active")
        .map((c) => ({ id: c.id, name: c.name })),
      matters: db.matters
        .filter((m) => m.status !== "closed")
        .map((m) => ({ id: m.id, name: `${m.reference} — ${m.title}` })),
      lawyers: db.team
        .filter((u) => u.status === "active" && ["firm_admin", "partner", "lawyer"].includes(u.role))
        .map((u) => ({ id: u.id, name: u.name })),
      practiceAreas: db.settings.matterTypes,
      courts: db.settings.courts,
    }),
  ),

  http.get("/api/matters", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const status = url.searchParams.get("status") ?? "all";
    const area = url.searchParams.get("practiceArea") ?? "";
    const clientId = url.searchParams.get("clientId") ?? "";
    const sort = url.searchParams.get("sort") ?? "-openedAt";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

    let rows = db.matters.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (area && m.practiceArea !== area) return false;
      if (clientId && m.clientId !== clientId) return false;
      if (q && !`${m.title} ${m.reference} ${clientName(m.clientId)}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) =>
      sort === "openedAt" ? a.openedAt.localeCompare(b.openedAt) : b.openedAt.localeCompare(a.openedAt),
    );

    const total = rows.length;
    const items = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(listItem);
    return HttpResponse.json<Paginated<ReturnType<typeof listItem>>>({ items, total });
  }),

  http.post("/api/matters", async ({ request }) => {
    const b = (await request.json()) as Partial<MatterRow>;
    const year = new Date().getFullYear();
    const count = db.matters.filter((m) => m.reference.includes(String(year))).length + 1;
    const row: MatterRow = {
      id: nextId("mat"),
      reference: `TP-${year}-${String(count).padStart(4, "0")}`,
      title: b.title ?? "Untitled matter",
      clientId: b.clientId ?? db.clients[0].id,
      practiceArea: b.practiceArea ?? db.settings.matterTypes[0],
      status: "open",
      court: b.court ?? null,
      leadLawyerId: CURRENT_USER_ID,
      openedAt: new Date().toISOString(),
      closedAt: null,
      description: b.description ?? null,
    };
    db.matters.unshift(row);
    db.participants.push({ id: nextId("prt"), matterId: row.id, userId: CURRENT_USER_ID, role: "Lead" });
    logActivity("matter.opened", row.id, row.title);
    return HttpResponse.json(detail(row), { status: 201 });
  }),

  http.get("/api/matters/:id", ({ params }) => {
    const m = find(params.id as string);
    return m ? HttpResponse.json(detail(m)) : notFound();
  }),

  http.patch("/api/matters/:id", async ({ params, request }) => {
    const m = find(params.id as string);
    if (!m) return notFound();
    const b = (await request.json()) as Partial<MatterRow>;
    Object.assign(m, {
      title: b.title ?? m.title,
      practiceArea: b.practiceArea ?? m.practiceArea,
      court: b.court ?? null,
      description: b.description ?? null,
      clientId: b.clientId ?? m.clientId,
    });
    return HttpResponse.json(detail(m));
  }),

  http.post("/api/matters/:id/close", ({ params }) => {
    const m = find(params.id as string);
    if (!m) return notFound();
    m.status = "closed";
    m.closedAt = new Date().toISOString();
    logActivity("matter.closed", m.id, m.title);
    return HttpResponse.json(detail(m));
  }),

  http.get("/api/matters/:id/participants", ({ params }) =>
    HttpResponse.json(
      db.participants
        .filter((p) => p.matterId === params.id)
        .map((p) => ({ id: p.id, userId: p.userId, name: userName(p.userId) ?? "—", role: p.role })),
    ),
  ),
  http.post("/api/matters/:id/participants", async ({ params, request }) => {
    const b = (await request.json()) as { userId: string; role: string };
    const row = { id: nextId("prt"), matterId: params.id as string, userId: b.userId, role: b.role };
    db.participants.push(row);
    return HttpResponse.json({ id: row.id, userId: row.userId, name: userName(row.userId) ?? "—", role: row.role }, { status: 201 });
  }),
  http.delete("/api/matters/:id/participants/:pid", ({ params }) => {
    db.participants = db.participants.filter((p) => p.id !== params.pid);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/matters/:id/updates", ({ params }) =>
    HttpResponse.json(
      db.matterUpdates
        .filter((u) => u.matterId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((u) => ({
          id: u.id,
          author: userName(u.authorId) ?? "—",
          body: u.body,
          documents: u.documentIds
            .map((did) => db.documents.find((d) => d.id === did))
            .filter(Boolean)
            .map((d) => ({ id: d!.id, name: d!.name })),
          createdAt: u.createdAt,
        })),
    ),
  ),
  http.post("/api/matters/:id/updates", async ({ params, request }) => {
    const m = find(params.id as string);
    if (!m) return notFound();
    const b = (await request.json()) as { body: string; documentIds?: string[] };
    const row = {
      id: nextId("upd"),
      matterId: m.id,
      authorId: CURRENT_USER_ID,
      body: b.body,
      documentIds: b.documentIds ?? [],
      createdAt: new Date().toISOString(),
    };
    db.matterUpdates.push(row);
    logActivity("matter.update_added", m.id, m.title);
    return HttpResponse.json(
      { id: row.id, author: userName(CURRENT_USER_ID) ?? "—", body: row.body, documents: [], createdAt: row.createdAt },
      { status: 201 },
    );
  }),

  http.get("/api/matters/:id/notes", ({ params }) =>
    HttpResponse.json(
      db.notes
        .filter((n) => n.matterId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => ({
          id: n.id,
          author: userName(n.authorId) ?? "—",
          authorId: n.authorId,
          body: n.body,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        })),
    ),
  ),
  http.post("/api/matters/:id/notes", async ({ params, request }) => {
    const m = find(params.id as string);
    if (!m) return notFound();
    const b = (await request.json()) as { body: string };
    const at = new Date().toISOString();
    const row = { id: nextId("nte"), matterId: m.id, authorId: CURRENT_USER_ID, body: b.body, createdAt: at, updatedAt: at };
    db.notes.push(row);
    return HttpResponse.json(
      { id: row.id, author: userName(CURRENT_USER_ID) ?? "—", authorId: CURRENT_USER_ID, body: row.body, createdAt: at, updatedAt: at },
      { status: 201 },
    );
  }),
  http.patch("/api/matters/:id/notes/:nid", async ({ params, request }) => {
    const n = db.notes.find((x) => x.id === params.nid);
    if (!n) return notFound();
    const b = (await request.json()) as { body: string };
    n.body = b.body;
    n.updatedAt = new Date().toISOString();
    return HttpResponse.json({ id: n.id, author: userName(n.authorId) ?? "—", authorId: n.authorId, body: n.body, createdAt: n.createdAt, updatedAt: n.updatedAt });
  }),
  http.delete("/api/matters/:id/notes/:nid", ({ params }) => {
    db.notes = db.notes.filter((n) => n.id !== params.nid);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/matters/:id/financials", ({ params }) => {
    const m = find(params.id as string);
    if (!m) return notFound();
    const invoices = db.invoices.filter((i) => i.matterId === m.id);
    const billed = invoices.map((i) => ({ currency: i.currency, amount: invoiceTotals(i).total }));
    const collected = invoices.map((i) => ({ currency: i.currency, amount: invoiceTotals(i).paid }));
    const outstanding = invoices.map((i) => ({ currency: i.currency, amount: invoiceTotals(i).balance }));
    const expenses = db.expenses
      .filter((e) => e.matterId === m.id)
      .map((e) => ({ currency: e.currency, amount: e.amount }));
    return HttpResponse.json({
      billed: money(billed),
      collected: money(collected),
      outstanding: money(outstanding),
      expenses: money(expenses),
      invoices: invoices.map((i) => {
        const tot = invoiceTotals(i);
        return { id: i.id, number: i.number, status: i.status, currency: i.currency, total: tot.total, balance: tot.balance };
      }),
    });
  }),

  http.get("/api/matters/:id/activity", ({ params }) =>
    HttpResponse.json(
      db.activity
        .filter((a) => a.targetId === params.id || (a.targetType === "hearing" && db.hearings.find((h) => h.id === a.targetId)?.matterId === params.id))
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => ({ id: a.id, actor: userName(a.actorId) ?? "—", action: a.action, target: a.targetLabel, at: a.at })),
    ),
  ),
];
