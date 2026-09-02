import { httpClient } from "@/lib/api/http-client";

export interface TeamMember {
  id: string;
  name: string;
  title: string;
  role: string;
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
