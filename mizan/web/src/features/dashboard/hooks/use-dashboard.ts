import { useQuery } from "@tanstack/react-query";
import { dashboardKeys, getDashboard } from "../api/dashboard.api";

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.root,
    queryFn: ({ signal }) => getDashboard(signal),
  });
}
