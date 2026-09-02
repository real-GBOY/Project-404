import { http, HttpResponse } from "msw";
import { CURRENT_USER_ID, db, matterTitle, nextId, userName, type CalendarEventRow } from "../fixtures/db";

export interface CalendarItem {
  id: string;
  kind: "hearing" | "deadline" | "event";
  eventKind?: string;
  title: string;
  at: string;
  endAt: string | null;
  matterId: string | null;
  matterTitle: string | null;
  owner: string | null;
  ownerId: string | null;
}

const notFound = () =>
  HttpResponse.json({ code: "event.not_found", message: "Event not found." }, { status: 404 });

export const calendarHandlers = [
  http.get("/api/calendar", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "0000";
    const to = url.searchParams.get("to") ?? "9999";
    const lawyerId = url.searchParams.get("lawyerId");

    const items: CalendarItem[] = [];

    for (const h of db.hearings) {
      if (h.scheduledAt < from || h.scheduledAt > to) continue;
      const m = db.matters.find((x) => x.id === h.matterId);
      if (lawyerId && m?.leadLawyerId !== lawyerId) continue;
      items.push({
        id: h.id,
        kind: "hearing",
        title: `${h.purpose} — ${m?.reference ?? ""}`,
        at: h.scheduledAt,
        endAt: null,
        matterId: h.matterId,
        matterTitle: matterTitle(h.matterId),
        owner: userName(m?.leadLawyerId ?? null),
        ownerId: m?.leadLawyerId ?? null,
      });
    }

    for (const e of db.events) {
      if (e.startAt < from || e.startAt > to) continue;
      if (lawyerId && e.ownerId !== lawyerId) continue;
      items.push({
        id: e.id,
        kind: e.kind === "court_filing" || e.kind === "reminder" ? "deadline" : "event",
        eventKind: e.kind,
        title: e.title,
        at: e.startAt,
        endAt: e.endAt,
        matterId: e.matterId,
        matterTitle: matterTitle(e.matterId),
        owner: userName(e.ownerId),
        ownerId: e.ownerId,
      });
    }

    for (const k of db.tasks) {
      if (!k.dueAt || k.status === "done") continue;
      if (k.dueAt < from || k.dueAt > to) continue;
      if (lawyerId && k.assigneeId !== lawyerId) continue;
      items.push({
        id: `task-${k.id}`,
        kind: "deadline",
        eventKind: "task",
        title: k.title,
        at: k.dueAt,
        endAt: null,
        matterId: k.matterId,
        matterTitle: matterTitle(k.matterId),
        owner: userName(k.assigneeId),
        ownerId: k.assigneeId,
      });
    }

    items.sort((a, b) => a.at.localeCompare(b.at));
    return HttpResponse.json({ items });
  }),

  http.post("/api/calendar/events", async ({ request }) => {
    const b = (await request.json()) as Partial<CalendarEventRow>;
    const row: CalendarEventRow = {
      id: nextId("evt"),
      title: b.title ?? "Untitled",
      kind: (b.kind as CalendarEventRow["kind"]) ?? "meeting",
      startAt: b.startAt ?? new Date().toISOString(),
      endAt: b.endAt ?? null,
      matterId: b.matterId ?? null,
      ownerId: b.ownerId ?? CURRENT_USER_ID,
    };
    db.events.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch("/api/calendar/events/:id", async ({ params, request }) => {
    const e = db.events.find((x) => x.id === params.id);
    if (!e) return notFound();
    const b = (await request.json()) as Partial<CalendarEventRow>;
    Object.assign(e, {
      title: b.title ?? e.title,
      startAt: b.startAt ?? e.startAt,
      endAt: b.endAt === undefined ? e.endAt : b.endAt,
      kind: b.kind ?? e.kind,
    });
    return HttpResponse.json(e);
  }),

  http.delete("/api/calendar/events/:id", ({ params }) => {
    db.events = db.events.filter((e) => e.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
