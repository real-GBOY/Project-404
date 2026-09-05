import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { hearingKeys } from "./api";
import { useHearing } from "./hooks";
import { dashboardKeys } from "@/features/dashboard/api";

/**
 * "Check in at court" — server-recorded now (`POST /hearings/:id/check-in`).
 * `checkedInAt` comes straight off the hearing detail; the mutation is
 * idempotent server-side.
 */
export function useCheckIn(hearingId: string) {
  const qc = useQueryClient();
  const { data: hearing } = useHearing(hearingId);

  const mutation = useMutation({
    mutationFn: () => api.checkInHearing(hearingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hearingKeys.detail(hearingId) });
      qc.invalidateQueries({ queryKey: hearingKeys.all });
      qc.invalidateQueries({ queryKey: dashboardKeys.root });
    },
  });

  return { checkedInAt: hearing?.checkedInAt ?? null, checkIn: mutation };
}
