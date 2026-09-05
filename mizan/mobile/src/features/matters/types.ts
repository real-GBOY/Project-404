import type { Money, Paginated } from "@/types/api";

/** Ported from mizan/web/src/features/matters/types/matter.ts — same contract. */
export type MatterStatus = "open" | "on_hold" | "closed";

export interface MatterListItem {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  clientName: string;
  practiceArea: string;
  court: string | null;
  status: MatterStatus;
  leadLawyer: string;
  openedAt: string;
  nextHearingAt: string | null;
  openTasks: number;
  value: Money[];
}

export interface MattersSummary {
  total: number;
  active: number;
  onHold: number;
  closedThisYear: number;
  aggregateValue: Money[];
}

export interface MatterParticipant {
  id: string;
  userId: string;
  name: string;
  role: string;
}

export interface MatterUpdate {
  id: string;
  author: string;
  body: string;
  documents: { id: string; name: string }[];
  createdAt: string;
}

export interface MatterNote {
  id: string;
  author: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatterFinancials {
  billed: Money[];
  collected: Money[];
  outstanding: Money[];
  expenses: Money[];
  invoices: { id: string; number: string; status: string; currency: string; total: number; balance: number }[];
}

export interface Matter {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  clientId: string;
  clientName: string;
  practiceArea: string;
  status: MatterStatus;
  court: string | null;
  leadLawyer: { id: string; name: string };
  openedAt: string;
  closedAt: string | null;
  value: Money[];
  participants: MatterParticipant[];
  counts: { hearings: number; tasks: number; openTasks: number; documents: number; notes: number };
}

export interface MatterActivityRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export type MatterList = Paginated<MatterListItem> & { summary: MattersSummary };

export interface MatterListParams {
  q?: string;
  status?: MatterStatus | "all";
  practiceArea?: string;
  clientId?: string;
  sort?: string;
  page?: number;
}
