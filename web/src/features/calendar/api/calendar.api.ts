import { httpClient } from "@/lib/api/http-client";

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

export const calendarKeys = {
  all: ["calendar"] as const,
  range: (from: string, to: string, lawyerId?: string) =>
    [...calendarKeys.all, from, to, lawyerId ?? null] as const,
};

export const getCalendar = (
  p: { from: string; to: string; lawyerId?: string },
  signal?: AbortSignal,
) =>
  httpClient<{ items: CalendarItem[] }>("/calendar", {
    query: { from: p.from, to: p.to, lawyerId: p.lawyerId },
    signal,
  });

export const createEvent = (body: {
  title: string;
  kind: string;
  startAt: string;
  endAt?: string | null;
  matterId?: string | null;
}) => httpClient<unknown>("/calendar/events", { method: "POST", body });

export const deleteEvent = (id: string) =>
  httpClient<void>(`/calendar/events/${id}`, { method: "DELETE" });
