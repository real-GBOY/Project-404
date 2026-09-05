import { httpClient } from "@/lib/api/http-client";
import type {
  CreateTimeEntryBody,
  TimeEntry,
  TimeEntryListParams,
  UnbilledSummary,
} from "./types";

export const timeKeys = {
  all: ["time-entries"] as const,
  list: (p: TimeEntryListParams) => [...timeKeys.all, "list", p] as const,
  summary: () => [...timeKeys.all, "summary"] as const,
};

export const listTimeEntries = (p: TimeEntryListParams, signal?: AbortSignal) =>
  httpClient<{ items: TimeEntry[]; total: number }>("/time-entries", {
    query: { mine: p.mine, matterId: p.matterId, status: p.status },
    signal,
  });

/** `GET /time-entries/summary` — unbilled time grouped by matter. */
export const getUnbilledSummary = (mine: boolean, signal?: AbortSignal) =>
  httpClient<UnbilledSummary>("/time-entries/summary", { query: { mine }, signal });

export const createTimeEntry = (body: CreateTimeEntryBody) =>
  httpClient<TimeEntry>("/time-entries", { method: "POST", body });

export const updateTimeEntry = (
  id: string,
  body: Partial<Pick<CreateTimeEntryBody, "activity" | "narrative" | "minutes" | "billable">>,
) => httpClient<TimeEntry>(`/time-entries/${id}`, { method: "PATCH", body });

export const deleteTimeEntry = (id: string) =>
  httpClient<{ ok: true }>(`/time-entries/${id}`, { method: "DELETE" });
