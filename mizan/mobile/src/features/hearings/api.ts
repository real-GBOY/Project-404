import { httpClient } from "@/lib/api/http-client";
import type { HearingRow, HearingListParams } from "./types";

export const hearingKeys = {
  all: ["hearings"] as const,
  list: (p: HearingListParams) => [...hearingKeys.all, "list", p] as const,
  detail: (id: string) => [...hearingKeys.all, "detail", id] as const,
};

export const listHearings = (p: HearingListParams, signal?: AbortSignal) =>
  httpClient<{ items: HearingRow[]; total: number }>("/hearings", {
    query: { matterId: p.matterId, status: p.status, scope: p.scope, from: p.from, to: p.to },
    signal,
  });

export const getHearing = (id: string, signal?: AbortSignal) => httpClient<HearingRow>(`/hearings/${id}`, { signal });

/** "Adjourned to a new date" outcome action. */
export const adjournHearing = (id: string, body: { newDate: string; reason?: string }) =>
  httpClient<{ adjourned: HearingRow; next: HearingRow }>(`/hearings/${id}/adjourn`, { method: "POST", body });

/** "Pleadings heard" / "Judgment issued" outcome actions (free-text field). */
export const recordOutcome = (id: string, body: { outcome: string }) =>
  httpClient<HearingRow>(`/hearings/${id}/outcome`, { method: "POST", body });
