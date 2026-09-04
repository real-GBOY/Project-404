import { httpClient } from "@/lib/api/http-client";

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  role: string;
  department: string;
  barAdmission: string;
  email: string;
  phone: string | null;
  practiceAreas: string[];
  status: "active" | "inactive";
  weeklyCapacityHours: number;
  activeMatters: number;
  openTasks: number;
  upcomingHearings: number;
  utilization: number;
}

export interface TeamSummary {
  feeEarners: number;
  support: number;
  avgUtilisation: number;
  onLeave: number;
}

export interface TeamMemberDetail extends TeamMember {
  matters: { id: string; reference: string; title: string; role: string }[];
}

export const teamKeys = {
  all: ["team"] as const,
  detail: (id: string) => ["team", "detail", id] as const,
};

export const listTeam = (signal?: AbortSignal) =>
  httpClient<{ items: TeamMember[] }>("/team", { signal });

export const getTeamMember = (id: string, signal?: AbortSignal) =>
  httpClient<TeamMemberDetail>(`/team/${id}`, { signal });

export const updateTeamMember = (
  id: string,
  body: Partial<Pick<TeamMember, "title" | "phone" | "practiceAreas" | "weeklyCapacityHours" | "status">>,
) => httpClient<TeamMember>(`/team/${id}`, { method: "PATCH", body });

export interface TeamCandidate {
  id: string;
  name: string;
  email: string;
}

export const listTeamCandidates = (signal?: AbortSignal) =>
  httpClient<{ items: TeamCandidate[] }>("/team/candidates", { signal });

export const createTeamMember = (body: {
  userId: string;
  title?: string;
  weeklyCapacityHours?: number;
}) => httpClient<TeamMember>("/team", { method: "POST", body });
