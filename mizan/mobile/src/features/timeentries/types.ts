import type { Money } from "@/types/api";

export type TimeEntryStatus = "unbilled" | "billed";

/** A single logged time entry — matches the backend `TimeService` view. */
export interface TimeEntry {
  id: string;
  matterId: string;
  matterTitle: string | null;
  matterReference: string | null;
  userId: string;
  loggedBy: string | null;
  activity: string;
  narrative: string | null;
  minutes: number;
  hours: number;
  billable: boolean;
  hourlyRate: number | null;
  currency: string;
  value: Money[];
  status: TimeEntryStatus;
  loggedAt: string;
  createdAt: string;
}

/** One matter's unbilled roll-up (`GET /time-entries/summary`). */
export interface UnbilledMatterSummary {
  matterId: string;
  matterTitle: string | null;
  matterReference: string | null;
  minutes: number;
  hours: number;
  value: Money[];
  currency: string;
}

export interface UnbilledSummary {
  items: UnbilledMatterSummary[];
  totals: Money[];
  totalMinutes: number;
  totalHours: number;
}

export interface TimeEntryListParams {
  mine?: boolean;
  matterId?: string;
  status?: TimeEntryStatus;
}

export interface CreateTimeEntryBody {
  matterId: string;
  activity: string;
  narrative?: string | null;
  minutes: number;
  billable?: boolean;
  loggedAt?: string;
}
