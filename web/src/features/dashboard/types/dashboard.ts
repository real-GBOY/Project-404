import type { Money } from "@/types/api";

export interface DashboardKpis {
  activeMatters: number;
  openTasks: number;
  hearingsThisWeek: number;
  /** per-currency, never summed (PLAN §6) */
  outstanding: Money[];
  collectedThisMonth: Money[];
}

export interface DashboardHearing {
  id: string;
  matterId: string;
  matterTitle: string;
  court: string;
  scheduledAt: string;
}

export interface DashboardDeadline {
  id: string;
  matterId: string;
  matterTitle: string;
  title: string;
  dueAt: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  matterTitle: string | null;
  dueAt: string | null;
  priority: "low" | "normal" | "high";
}

export interface DashboardDocument {
  id: string;
  name: string;
  matterTitle: string;
  uploadedAt: string;
}

export interface PracticeAreaSlice {
  area: string;
  matters: number;
}

/** Billing vs collections for the last months — EGP only, display-only. */
export interface BillingPoint {
  month: string;
  billed: number;
  collected: number;
  currency: string;
}

export interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  upcomingHearings: DashboardHearing[];
  urgentDeadlines: DashboardDeadline[];
  practiceAreas: PracticeAreaSlice[];
  billingSeries: BillingPoint[];
  myTasks: DashboardTask[];
  reviewDocuments: DashboardDocument[];
  recentActivity: ActivityEntry[];
}
