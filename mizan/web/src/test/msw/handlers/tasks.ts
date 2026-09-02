import { http, HttpResponse } from "msw";
import { CURRENT_USER_ID, db, nextId, userName, type TaskRow } from "../fixtures/db";

const find = (id: string) => db.tasks.find((k) => k.id === id);
const notFound = () =>
  HttpResponse.json({ code: "task.not_found", message: "Task not found." }, { status: 404 });

function view(k: TaskRow) {
  const m = k.matterId ? db.matters.find((x) => x.id === k.matterId) : null;
  const now = Date.now();
  return {
    id: k.id,
    title: k.title,
    matterId: k.matterId,
    matterTitle: m?.title ?? null,
    matterReference: m?.reference ?? null,
    assigneeId: k.assigneeId,
    assignee: userName(k.assigneeId),
    status: k.status,
    priority: k.priority,
    dueAt: k.dueAt,
    overdue: !!k.dueAt && k.status !== "done" && new Date(k.dueAt).getTime() < now,
    createdAt: k.createdAt,
    completedAt: k.completedAt,
  };
}

export const taskHandlers = [
  http.get("/api/tasks/summary", () => {
    const now = Date.now();
    const week = now + 7 * 86_400_000;
    const monthAgo = now - 30 * 86_400_000;
    return HttpResponse.json({
      open: db.tasks.filter((k) => k.status !== "done").length,
      dueThisWeek: db.tasks.filter(
        (k) => k.status !== "done" && k.dueAt && new Date(k.dueAt).getTime() <= week,
      ).length,
      overdue: db.tasks.filter(
        (k) => k.status !== "done" && k.dueAt && new Date(k.dueAt).getTime() < now,
      ).length,
      completed30d: db.tasks.filter(
        (k) => k.completedAt && new Date(k.completedAt).getTime() >= monthAgo,
      ).length,
    });
  }),

  http.get("/api/tasks", ({ request }) => {
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "true";
    const matterId = url.searchParams.get("matterId");
    const status = url.searchParams.get("status");
    const range = url.searchParams.get("range"); // today | week | overdue | all
    const now = Date.now();
    const endOfWeek = now + 7 * 86_400_000;

    let rows = [...db.tasks];
    if (mine) rows = rows.filter((k) => k.assigneeId === CURRENT_USER_ID);
    if (matterId) rows = rows.filter((k) => k.matterId === matterId);
    if (status && status !== "all") rows = rows.filter((k) => k.status === status);
    if (range === "today")
      rows = rows.filter(
        (k) => k.dueAt && new Date(k.dueAt).toDateString() === new Date().toDateString() && k.status !== "done",
      );
    if (range === "week")
      rows = rows.filter((k) => k.dueAt && new Date(k.dueAt).getTime() <= endOfWeek && k.status !== "done");
    if (range === "overdue")
      rows = rows.filter((k) => k.dueAt && new Date(k.dueAt).getTime() < now && k.status !== "done");

    rows.sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
    return HttpResponse.json({ items: rows.map(view), total: rows.length });
  }),

  http.post("/api/tasks", async ({ request }) => {
    const b = (await request.json()) as Partial<TaskRow>;
    const row: TaskRow = {
      id: nextId("tsk"),
      title: b.title ?? "Untitled task",
      matterId: b.matterId ?? null,
      assigneeId: b.assigneeId ?? CURRENT_USER_ID,
      status: "todo",
      priority: (b.priority as TaskRow["priority"]) ?? "normal",
      dueAt: b.dueAt ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    db.tasks.push(row);
    return HttpResponse.json(view(row), { status: 201 });
  }),

  http.patch("/api/tasks/:id", async ({ params, request }) => {
    const k = find(params.id as string);
    if (!k) return notFound();
    const b = (await request.json()) as Partial<TaskRow>;
    Object.assign(k, {
      title: b.title ?? k.title,
      priority: b.priority ?? k.priority,
      dueAt: b.dueAt === undefined ? k.dueAt : b.dueAt,
      status: b.status ?? k.status,
      assigneeId: b.assigneeId === undefined ? k.assigneeId : b.assigneeId,
    });
    return HttpResponse.json(view(k));
  }),

  http.post("/api/tasks/:id/complete", ({ params }) => {
    const k = find(params.id as string);
    if (!k) return notFound();
    k.status = k.status === "done" ? "todo" : "done";
    k.completedAt = k.status === "done" ? new Date().toISOString() : null;
    if (k.status === "done") {
      db.activity.unshift({
        id: nextId("act"),
        actorId: CURRENT_USER_ID,
        action: "task.completed",
        targetType: "task",
        targetId: k.id,
        targetLabel: k.title,
        at: new Date().toISOString(),
      });
    }
    return HttpResponse.json(view(k));
  }),

  http.post("/api/tasks/:id/assign", async ({ params, request }) => {
    const k = find(params.id as string);
    if (!k) return notFound();
    const b = (await request.json()) as { assigneeId: string | null };
    k.assigneeId = b.assigneeId;
    return HttpResponse.json(view(k));
  }),
];
