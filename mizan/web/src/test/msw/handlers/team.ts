import { http, HttpResponse } from "msw";
import { db, nextId, type TeamMemberRow } from "../fixtures/db";

const find = (id: string) => db.team.find((u) => u.id === id);
const notFound = () =>
  HttpResponse.json({ code: "staff.not_found", message: "Team member not found." }, { status: 404 });

function load(userId: string) {
  const leadMatters = db.matters.filter((m) => m.leadLawyerId === userId && m.status !== "closed").length;
  const participantMatters = db.participants.filter(
    (p) => p.userId === userId && db.matters.find((m) => m.id === p.matterId && m.status !== "closed"),
  ).length;
  const openTasks = db.tasks.filter((k) => k.assigneeId === userId && k.status !== "done").length;
  const upcomingHearings = db.hearings.filter((h) => {
    const m = db.matters.find((x) => x.id === h.matterId);
    return (
      m?.leadLawyerId === userId && h.status === "scheduled" && new Date(h.scheduledAt).getTime() >= Date.now()
    );
  }).length;
  const activeMatters = Math.max(leadMatters, participantMatters);
  return {
    activeMatters,
    openTasks,
    upcomingHearings,
    utilization: Math.min(100, Math.round(((openTasks * 4 + activeMatters * 3) / 40) * 100)),
  };
}

const FEE_ROLES = new Set(["firm_admin", "partner", "lawyer"]);

function barYear(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 1998 + (h % 24);
}

const view = (u: TeamMemberRow) => ({
  id: u.id,
  name: u.name,
  title: u.title,
  role: u.role,
  department: u.practiceAreas[0] ?? u.title,
  barAdmission: FEE_ROLES.has(u.role) ? `Cairo Bar · ${barYear(u.id)}` : "—",
  email: u.email,
  phone: u.phone,
  practiceAreas: u.practiceAreas,
  status: u.status,
  weeklyCapacityHours: u.weeklyCapacityHours,
  ...load(u.id),
});

export const teamHandlers = [
  http.get("/api/team/summary", () => {
    const active = db.team.filter((u) => u.status === "active");
    const feeEarners = active.filter((u) => FEE_ROLES.has(u.role)).length;
    const utils = active.map((u) => load(u.id).utilization);
    return HttpResponse.json({
      feeEarners,
      support: active.length - feeEarners,
      avgUtilisation: utils.length
        ? Math.round(utils.reduce((s, v) => s + v, 0) / utils.length)
        : 0,
      onLeave: db.team.filter((u) => u.status === "inactive").length,
    });
  }),

  http.get("/api/team", () =>
    HttpResponse.json({
      items: db.team
        .slice()
        .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1))
        .map(view),
    }),
  ),

  http.get("/api/team/:id", ({ params }) => {
    const u = find(params.id as string);
    if (!u) return notFound();
    const matters = db.matters
      .filter(
        (m) =>
          m.status !== "closed" &&
          (m.leadLawyerId === u.id || db.participants.some((p) => p.matterId === m.id && p.userId === u.id)),
      )
      .map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        role: m.leadLawyerId === u.id ? "Lead" : "Support",
      }));
    return HttpResponse.json({ ...view(u), matters });
  }),

  http.post("/api/team", async ({ request }) => {
    const b = (await request.json()) as Partial<TeamMemberRow>;
    const row: TeamMemberRow = {
      id: nextId("usr"),
      name: b.name ?? "New member",
      title: b.title ?? "Associate",
      role: b.role ?? "lawyer",
      email: b.email ?? "",
      phone: b.phone ?? null,
      practiceAreas: b.practiceAreas ?? [],
      status: "active",
      weeklyCapacityHours: b.weeklyCapacityHours ?? 40,
    };
    db.team.push(row);
    return HttpResponse.json(view(row), { status: 201 });
  }),

  http.patch("/api/team/:id", async ({ params, request }) => {
    const u = find(params.id as string);
    if (!u) return notFound();
    const b = (await request.json()) as Partial<TeamMemberRow>;
    Object.assign(u, {
      title: b.title ?? u.title,
      phone: b.phone === undefined ? u.phone : b.phone,
      practiceAreas: b.practiceAreas ?? u.practiceAreas,
      weeklyCapacityHours: b.weeklyCapacityHours ?? u.weeklyCapacityHours,
      status: b.status ?? u.status,
    });
    return HttpResponse.json(view(u));
  }),
];
