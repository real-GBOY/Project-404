import { useQuery } from "@tanstack/react-query";
import { getDashboard, dashboardKeys } from "./api";

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.root,
    queryFn: ({ signal }) => getDashboard(signal),
  });
}
