import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { matterKeys } from "./api";
import type { MatterListParams } from "./types";

export const useMatterList = (p: MatterListParams) =>
  useQuery({
    queryKey: matterKeys.list(p),
    queryFn: ({ signal }) => api.listMatters(p, signal),
    placeholderData: (prev) => prev,
  });

export const useMatter = (id: string) =>
  useQuery({ queryKey: matterKeys.detail(id), queryFn: ({ signal }) => api.getMatter(id, signal) });

export const useMatterParticipants = (id: string) =>
  useQuery({ queryKey: matterKeys.tab(id, "participants"), queryFn: ({ signal }) => api.getParticipants(id, signal) });
export const useMatterUpdates = (id: string) =>
  useQuery({ queryKey: matterKeys.tab(id, "updates"), queryFn: ({ signal }) => api.getUpdates(id, signal) });
export const useMatterNotes = (id: string) =>
  useQuery({ queryKey: matterKeys.tab(id, "notes"), queryFn: ({ signal }) => api.getNotes(id, signal) });
export const useMatterFinancials = (id: string) =>
  useQuery({ queryKey: matterKeys.tab(id, "financials"), queryFn: ({ signal }) => api.getMatterFinancials(id, signal) });
export const useMatterActivity = (id: string) =>
  useQuery({ queryKey: matterKeys.tab(id, "activity"), queryFn: ({ signal }) => api.getMatterActivity(id, signal) });

export function useMatterMutations(id?: string) {
  const qc = useQueryClient();
  const invalidateOne = () => id && qc.invalidateQueries({ queryKey: matterKeys.detail(id) });

  return {
    close: useMutation({ mutationFn: () => api.closeMatter(id!), onSuccess: invalidateOne }),
    addUpdate: useMutation({
      mutationFn: (b: { body: string; documentIds?: string[] }) => api.addUpdate(id!, b),
      onSuccess: invalidateOne,
    }),
    addNote: useMutation({
      mutationFn: (b: { body: string }) => api.addNote(id!, b),
      onSuccess: invalidateOne,
    }),
  };
}
