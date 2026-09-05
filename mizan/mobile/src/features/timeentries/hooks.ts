import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { timeKeys } from "./api";
import type { TimeEntryListParams } from "./types";

export const useTimeEntries = (p: TimeEntryListParams = {}) =>
  useQuery({
    queryKey: timeKeys.list(p),
    queryFn: ({ signal }) => api.listTimeEntries(p, signal),
    placeholderData: (prev) => prev,
  });

export const useUnbilledSummary = (mine = true) =>
  useQuery({
    queryKey: [...timeKeys.summary(), mine],
    queryFn: ({ signal }) => api.getUnbilledSummary(mine, signal),
  });

export function useTimeEntryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: timeKeys.all });
    qc.invalidateQueries({ queryKey: ["finance"] });
  };
  return {
    create: useMutation({ mutationFn: api.createTimeEntry, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.updateTimeEntry>[1]) =>
        api.updateTimeEntry(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: api.deleteTimeEntry, onSuccess: invalidate }),
  };
}
