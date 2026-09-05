export type HearingStatus = "scheduled" | "adjourned" | "decided";

/** Ported from mizan/web/src/features/hearings/api/hearings.api.ts. */
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

export interface HearingListParams {
  matterId?: string;
  status?: HearingStatus | "all";
  scope?: "upcoming" | "past";
  from?: string;
  to?: string;
}
