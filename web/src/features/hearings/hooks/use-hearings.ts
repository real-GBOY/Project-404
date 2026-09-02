import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast-context";
import * as api from "../api/hearings.api";
import { hearingKeys, type HearingListParams } from "../api/hearings.api";
import { matterKeys } from "@/features/matters/api/matters.api";

export const useHearingList = (p: HearingListParams) =>
  useQuery({
    queryKey: hearingKeys.list(p),
    queryFn: ({ signal }) => api.listHearings(p, signal),
    placeholderData: (prev) => prev,
  });

export function useHearingMutations(matterId?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("hearings");
  const done = (key: string) => {
    qc.invalidateQueries({ queryKey: hearingKeys.all });
    if (matterId) qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
    toast.success({ title: t(key) });
  };
  const fail = () => toast.error({ title: t("toasts.failed") });

  return {
    schedule: useMutation({
      mutationFn: api.scheduleHearing,
      onSuccess: () => done("toasts.scheduled"),
      onError: fail,
    }),
    adjourn: useMutation({
      mutationFn: ({ id, ...body }: { id: string; newDate: string; reason?: string }) =>
        api.adjournHearing(id, body),
      onSuccess: () => done("toasts.adjourned"),
      onError: fail,
    }),
    outcome: useMutation({
      mutationFn: ({ id, outcome }: { id: string; outcome: string }) =>
        api.recordOutcome(id, { outcome }),
      onSuccess: () => done("toasts.outcome_recorded"),
      onError: fail,
    }),
  };
}
