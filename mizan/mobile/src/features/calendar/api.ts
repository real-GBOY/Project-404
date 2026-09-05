import { httpClient } from "@/lib/api/http-client";
import type { CalendarItem } from "./types";

export const calendarKeys = {
  all: ["calendar"] as const,
  range: (from: string, to: string, lawyerId?: string) => [...calendarKeys.all, from, to, lawyerId ?? null] as const,
};

export const getCalendar = (p: { from: string; to: string; lawyerId?: string }, signal?: AbortSignal) =>
  httpClient<{ items: CalendarItem[] }>("/calendar", {
    query: { from: p.from, to: p.to, lawyerId: p.lawyerId },
    signal,
  });
