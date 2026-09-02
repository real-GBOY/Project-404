import { http, HttpResponse } from "msw";
import type { Money, Paginated } from "@/types/api";
import { db, invoiceTotals, matterTitle, nextId, userName, type ClientRow } from "../fixtures/db";

const PAGE_SIZE = 10;

function outstandingFor(clientId: string): Money[] {
  const map = new Map<string, number>();
  for (const inv of db.invoices) {
    if (inv.clientId !== clientId) continue;
    if (inv.status !== "sent" && inv.status !== "issued") continue;
    const bal = invoiceTotals(inv).balance;
    if (bal > 0) map.set(inv.currency, (map.get(inv.currency) ?? 0) + bal);
  }
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount: String(amount) }));
}

function cityOf(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || null;
}

function relationshipPartner(clientId: string): string | null {
  const matters = db.matters.filter((m) => m.clientId === clientId);
  const counts = new Map<string, number>();
  for (const m of matters) counts.set(m.leadLawyerId, (counts.get(m.leadLawyerId) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? userName(top[0]) : null;
}

function listItem(c: ClientRow) {
  const matters = db.matters.filter((m) => m.clientId === c.id);
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    email: c.email,
    phone: c.phone,
    city: cityOf(c.address),
    contactName: primaryContact(c.id)?.name ?? null,
    partner: relationshipPartner(c.id),
    openMatters: matters.filter((m) => m.status !== "closed").length,
    totalMatters: matters.length,
    outstanding: outstandingFor(c.id),
    createdAt: c.createdAt,
  };
}

function primaryContact(clientId: string) {
  const row = db.contacts.find((k) => k.clientId === clientId && k.primary) ?? null;
  return row
    ? { id: row.id, name: row.name, role: row.role, email: row.email, phone: row.phone, primary: row.primary }
    : null;
}

function moneyList(entries: { currency: string; amount: number }[]) {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  return [...map.entries()]
    .filter(([, a]) => a !== 0)
    .map(([currency, amount]) => ({ currency, amount: String(Math.round(amount)) }));
}

function detail(c: ClientRow) {
  const matters = db.matters.filter((m) => m.clientId === c.id);
  const invoices = db.invoices.filter((i) => i.clientId === c.id);
  const billedToDate = moneyList(
    invoices
      .filter((i) => i.status !== "draft" && i.status !== "void")
      .map((i) => ({ currency: i.currency, amount: invoiceTotals(i).total })),
  );
  const collected = moneyList(
    db.payments
      .filter((p) => invoices.some((i) => i.id === p.invoiceId))
      .map((p) => ({ currency: p.currency, amount: p.amount })),
  );
  const openTasks = db.tasks.filter(
    (task) => task.status !== "done" && matters.some((m) => m.id === task.matterId),
  ).length;

  return {
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    email: c.email,
    phone: c.phone,
    taxId: c.taxId,
    address: c.address,
    city: cityOf(c.address),
    notes: c.notes,
    createdAt: c.createdAt,
    partner: relationshipPartner(c.id),
    registration:
      c.taxId ?? (c.type === "individual" ? "National ID on file" : "Registration on file"),
    stats: {
      openMatters: matters.filter((m) => m.status !== "closed").length,
      totalMatters: matters.length,
      documents: db.documents.filter((d) => matters.some((m) => m.id === d.matterId)).length,
      outstanding: outstandingFor(c.id),
      billedToDate,
      collected,
      unbilledHours: Math.round(openTasks * 6.2 * 10) / 10,
    },
    primaryContact: primaryContact(c.id),
  };
}

function find(id: string): ClientRow | undefined {
  return db.clients.find((c) => c.id === id);
}

const notFound = () => HttpResponse.json({ code: "client.not_found", message: "Client not found." }, { status: 404 });

export const clientHandlers = [
  http.get("/api/clients", ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const status = url.searchParams.get("status") ?? "all";
    const type = url.searchParams.get("type") ?? "all";
    const sort = url.searchParams.get("sort") ?? "name";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));

    let rows = db.clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (type !== "all" && c.type !== type) return false;
      if (q && !`${c.name} ${c.email ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "-createdAt") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "createdAt") return a.createdAt.localeCompare(b.createdAt);
      return a.name.localeCompare(b.name);
    });

    const total = rows.length;
    const start = (page - 1) * PAGE_SIZE;
    const items = rows.slice(start, start + PAGE_SIZE).map(listItem);

    const outMap = new Map<string, number>();
    for (const c of db.clients) {
      for (const m of outstandingFor(c.id)) {
        outMap.set(m.currency, (outMap.get(m.currency) ?? 0) + Number(m.amount));
      }
    }
    const summary = {
      total: db.clients.length,
      companies: db.clients.filter((c) => c.type === "company").length,
      individuals: db.clients.filter((c) => c.type === "individual").length,
      outstanding: [...outMap.entries()].map(([currency, amount]) => ({
        currency,
        amount: String(Math.round(amount)),
      })),
    };

    return HttpResponse.json<Paginated<ReturnType<typeof listItem>> & { summary: typeof summary }>({
      items,
      total,
      summary,
    });
  }),

  http.post("/api/clients", async ({ request }) => {
    const body = (await request.json()) as Partial<ClientRow>;
    const row: ClientRow = {
      id: nextId("cli"),
      name: body.name ?? "Untitled",
      type: (body.type as ClientRow["type"]) ?? "company",
      status: "active",
      email: body.email ?? null,
      phone: body.phone ?? null,
      taxId: body.taxId ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
      createdAt: new Date().toISOString(),
    };
    db.clients.unshift(row);
    db.activity.unshift({
      id: nextId("act"),
      actorId: "usr_dev",
      action: "client.created",
      targetType: "client",
      targetId: row.id,
      targetLabel: row.name,
      at: new Date().toISOString(),
    });
    return HttpResponse.json(detail(row), { status: 201 });
  }),

  http.get("/api/clients/:id", ({ params }) => {
    const c = find(params.id as string);
    return c ? HttpResponse.json(detail(c)) : notFound();
  }),

  http.patch("/api/clients/:id", async ({ params, request }) => {
    const c = find(params.id as string);
    if (!c) return notFound();
    const body = (await request.json()) as Partial<ClientRow>;
    Object.assign(c, {
      name: body.name ?? c.name,
      type: body.type ?? c.type,
      email: body.email ?? null,
      phone: body.phone ?? null,
      taxId: body.taxId ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
    });
    return HttpResponse.json(detail(c));
  }),

  http.post("/api/clients/:id/archive", ({ params }) => {
    const c = find(params.id as string);
    if (!c) return notFound();
    c.status = "archived";
    return HttpResponse.json(detail(c));
  }),

  http.get("/api/clients/:id/contacts", ({ params }) => {
    const rows = db.contacts.filter((k) => k.clientId === params.id);
    return HttpResponse.json(
      rows.map((k) => ({ id: k.id, name: k.name, role: k.role, email: k.email, phone: k.phone, primary: k.primary })),
    );
  }),

  http.post("/api/clients/:id/contacts", async ({ params, request }) => {
    const c = find(params.id as string);
    if (!c) return notFound();
    const body = (await request.json()) as { name: string; role?: string; email?: string; phone?: string; primary?: boolean };
    if (body.primary) db.contacts.forEach((k) => (k.clientId === c.id ? (k.primary = false) : k));
    const row = {
      id: nextId("con"),
      clientId: c.id,
      name: body.name,
      role: body.role ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      primary: !!body.primary,
    };
    db.contacts.push(row);
    return HttpResponse.json(
      { id: row.id, name: row.name, role: row.role, email: row.email, phone: row.phone, primary: row.primary },
      { status: 201 },
    );
  }),

  http.get("/api/clients/:id/matters", ({ params }) =>
    HttpResponse.json(
      db.matters
        .filter((m) => m.clientId === params.id)
        .map((m) => {
          const next = db.hearings
            .filter(
              (h) =>
                h.matterId === m.id &&
                h.status === "scheduled" &&
                new Date(h.scheduledAt).getTime() >= Date.now(),
            )
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
          return {
            id: m.id,
            reference: m.reference,
            title: m.title,
            practiceArea: m.practiceArea,
            court: m.court,
            leadLawyer: userName(m.leadLawyerId) ?? "—",
            status: m.status,
            openedAt: m.openedAt,
            nextHearing: next?.scheduledAt ?? null,
          };
        }),
    ),
  ),

  http.get("/api/clients/:id/documents", ({ params }) => {
    const matterIds = db.matters.filter((m) => m.clientId === params.id).map((m) => m.id);
    return HttpResponse.json(
      db.documents
        .filter((d) => d.matterId && matterIds.includes(d.matterId))
        .map((d) => ({
          id: d.id,
          name: d.name,
          matterTitle: matterTitle(d.matterId) ?? "—",
          category: d.category,
          status: d.status,
          uploadedAt: d.uploadedAt,
        })),
    );
  }),

  http.get("/api/clients/:id/billing", ({ params }) =>
    HttpResponse.json(
      db.invoices
        .filter((i) => i.clientId === params.id)
        .map((i) => {
          const totals = invoiceTotals(i);
          return {
            id: i.id,
            number: i.number,
            status: i.status,
            currency: i.currency,
            total: totals.total,
            balance: totals.balance,
            issuedAt: i.issuedAt,
          };
        }),
    ),
  ),

  http.get("/api/clients/:id/activity", ({ params }) => {
    const c = find(params.id as string);
    if (!c) return notFound();
    const matterIds = db.matters.filter((m) => m.clientId === c.id).map((m) => m.id);
    return HttpResponse.json(
      db.activity
        .filter((a) => a.targetId === c.id || (a.targetType === "matter" && matterIds.includes(a.targetId)))
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((a) => ({ id: a.id, actor: userName(a.actorId) ?? "—", action: a.action, target: a.targetLabel, at: a.at })),
    );
  }),
];
