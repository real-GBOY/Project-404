import { useQuery } from "@tanstack/react-query";
import { listTeam, teamKeys } from "./api";

export const useTeamList = () => useQuery({ queryKey: teamKeys.all, queryFn: ({ signal }) => listTeam(signal) });
