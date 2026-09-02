import { http, HttpResponse } from "msw";
import { db, userName } from "../fixtures/db";

const ROLES = [
  { key: "firm_admin", name: "Firm administrator", permissions: 42, editable: false },
  { key: "partner", name: "Partner", permissions: 38, editable: true },
  { key: "lawyer", name: "Lawyer", permissions: 24, editable: true },
  { key: "paralegal", name: "Paralegal", permissions: 14, editable: true },
  { key: "finance", name: "Finance", permissions: 12, editable: true },
  { key: "read_only", name: "Read only", permissions: 8, editable: true },
];

const AUDIT: { id: string; actor: string; action: string; resource: string; at: string; ip: string }[] =
  db.activity.map((a, i) => ({
    id: `aud_${i}`,
    actor: userName(a.actorId) ?? "—",
    action: a.action,
    resource: `${a.targetType}:${a.targetId}`,
    at: a.at,
    ip: "197.44.10.2" + (i % 5),
  }));

export const settingsHandlers = [
  http.get("/api/lawfirm/settings", () => HttpResponse.json(db.settings)),

  http.patch("/api/lawfirm/settings", async ({ request }) => {
    const b = (await request.json()) as Partial<typeof db.settings>;
    Object.assign(db.settings, b);
    return HttpResponse.json(db.settings);
  }),

  http.get("/api/rbac/roles", () => HttpResponse.json({ items: ROLES })),

  http.get("/api/rbac/members", () =>
    HttpResponse.json({
      items: db.team.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
      })),
    }),
  ),

  http.post("/api/rbac/assignments", async ({ request }) => {
    const b = (await request.json()) as { userId: string; role: string };
    const u = db.team.find((x) => x.id === b.userId);
    if (u) u.role = b.role;
    return HttpResponse.json({ ok: true });
  }),

  http.get("/api/audit-logs", ({ request }) => {
    const q = (new URL(request.url).searchParams.get("q") ?? "").toLowerCase();
    const rows = q
      ? AUDIT.filter((a) => `${a.actor} ${a.action} ${a.resource}`.toLowerCase().includes(q))
      : AUDIT;
    return HttpResponse.json({ items: rows.slice(0, 50), total: rows.length });
  }),
];
