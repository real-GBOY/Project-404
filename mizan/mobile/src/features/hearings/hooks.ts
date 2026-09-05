import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { hearingKeys } from "./api";
import type { HearingListParams } from "./types";
import { matterKeys } from "@/features/matters/api";
import { dashboardKeys } from "@/features/dashboard/api";

export const useHearingList = (p: HearingListParams) =>
  useQuery({
    queryKey: hearingKeys.list(p),
    queryFn: ({ signal }) => api.listHearings(p, signal),
    placeholderData: (prev) => prev,
  });

export const useHearing = (id: string) =>
  useQuery({ queryKey: hearingKeys.detail(id), queryFn: ({ signal }) => api.getHearing(id, signal) });

export function useHearingMutations(matterId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: hearingKeys.all });
    if (matterId) qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
    qc.invalidateQueries({ queryKey: dashboardKeys.root });
  };

  return {
    adjourn: useMutation({
      mutationFn: ({ id, ...body }: { id: string; newDate: string; reason?: string }) => api.adjournHearing(id, body),
      onSuccess: invalidate,
    }),
    outcome: useMutation({
      mutationFn: ({ id, outcome }: { id: string; outcome: string }) => api.recordOutcome(id, { outcome }),
      onSuccess: invalidate,
    }),
  };
}
