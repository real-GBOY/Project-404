import { httpClient } from "@/lib/api/http-client";

/** Ported from mizan/web/src/features/team/api/team.api.ts. */
export interface TeamMember {
  id: string;
  name: string;
  title: string;
  role: string;
  department: string;
  status: "active" | "inactive";
}

export const teamKeys = { all: ["team"] as const };

export const listTeam = (signal?: AbortSignal) => httpClient<{ items: TeamMember[] }>("/team", { signal });
