import { httpClient } from "@/lib/api/http-client";

export type HearingStatus = "scheduled" | "adjourned" | "decided";

export interface HearingRow {
  id: string;
  matterId: string;
  matterTitle: string;
  matterReference: string;
  clientName: string;
  leadLawyer: string;
  court: string;
  scheduledAt: string;
  status: HearingStatus;
  purpose: string;
  outcome: string | null;
}

export interface HearingsSummary {
  scheduled: number;
  next7: number;
  awaitingDate: number;
  adjournedQuarter: number;
}

export interface HearingListParams {
  matterId?: string;
  status?: HearingStatus | "all";
  scope?: "upcoming" | "past";
  from?: string;
  to?: string;
}

export const hearingKeys = {
  all: ["hearings"] as const,
  list: (p: HearingListParams) => [...hearingKeys.all, "list", p] as const,
};

export const listHearings = (p: HearingListParams, signal?: AbortSignal) =>
  httpClient<{ items: HearingRow[]; total: number }>("/hearings", {
    query: { matterId: p.matterId, status: p.status, scope: p.scope, from: p.from, to: p.to },
    signal,
  });

export const scheduleHearing = (body: {
  matterId: string;
  scheduledAt: string;
  court?: string;
  purpose: string;
}) => httpClient<HearingRow>("/hearings", { method: "POST", body });

export const adjournHearing = (id: string, body: { newDate: string; reason?: string }) =>
  httpClient<{ adjourned: HearingRow; next: HearingRow }>(`/hearings/${id}/adjourn`, {
    method: "POST",
    body,
  });

export const recordOutcome = (id: string, body: { outcome: string }) =>
  httpClient<HearingRow>(`/hearings/${id}/outcome`, { method: "POST", body });
