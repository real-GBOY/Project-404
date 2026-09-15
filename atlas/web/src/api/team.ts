import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { get, ENDPOINTS } from "@/config";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active";
  assignedLeads: number;
}

interface TeamResponse {
  items: TeamMember[];
}

export interface TeamListParams {
  role?: string;
  q?: string;
}

export function useTeam(params?: TeamListParams) {
  return useQuery({ queryKey: ["team", params ?? {}], queryFn: () => get<TeamResponse>(ENDPOINTS.team, params) });
}

/** Every domain that shows an "agent" name needs userId -> display-name; this is the one place that mapping lives. */
export function useTeamDirectory() {
  const { data, isLoading, error } = useTeam();
  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data?.items ?? []) map.set(m.id, m.name);
    return map;
  }, [data]);
  return { byId, members: data?.items ?? [], isLoading, error };
}
