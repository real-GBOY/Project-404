import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

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

export function useTeam() {
  return useQuery({ queryKey: ["team"], queryFn: () => apiFetch<TeamResponse>("/team") });
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
