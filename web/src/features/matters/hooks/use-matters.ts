import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast-context";
import * as api from "../api/matters.api";
import { matterKeys } from "../api/matters.api";
import type { MatterFormOutput } from "../schemas/matter.schema";
import type { MatterListParams } from "../types/matter";

export const useMatterList = (p: MatterListParams) =>
  useQuery({
    queryKey: matterKeys.list(p),
    queryFn: ({ signal }) => api.listMatters(p, signal),
    placeholderData: (prev) => prev,
  });

export const useMatter = (id: string) =>
  useQuery({ queryKey: matterKeys.detail(id), queryFn: ({ signal }) => api.getMatter(id, signal) });

export const useMatterFormOptions = () =>
  useQuery({
    queryKey: [...matterKeys.all, "form-options"],
    queryFn: ({ signal }) => api.getMatterFormOptions(signal),
    staleTime: 5 * 60_000,
  });

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
  const toast = useToast();
  const { t } = useTranslation("matters");
  const invalidateAll = () => qc.invalidateQueries({ queryKey: matterKeys.all });
  const invalidateOne = () => id && qc.invalidateQueries({ queryKey: matterKeys.detail(id) });
  const fail = () => toast.error({ title: t("toasts.save_failed") });

  return {
    create: useMutation({
      mutationFn: (b: MatterFormOutput) => api.createMatter(b),
      onSuccess: () => { invalidateAll(); toast.success({ title: t("toasts.created") }); },
      onError: fail,
    }),
    update: useMutation({
      mutationFn: (b: Partial<MatterFormOutput>) => api.updateMatter(id!, b),
      onSuccess: () => { invalidateAll(); toast.success({ title: t("toasts.updated") }); },
      onError: fail,
    }),
    close: useMutation({
      mutationFn: () => api.closeMatter(id!),
      onSuccess: () => { invalidateAll(); toast.success({ title: t("toasts.closed") }); },
      onError: fail,
    }),
    addUpdate: useMutation({
      mutationFn: (b: { body: string; documentIds?: string[] }) => api.addUpdate(id!, b),
      onSuccess: () => { invalidateOne(); toast.success({ title: t("toasts.update_added") }); },
      onError: fail,
    }),
    addNote: useMutation({
      mutationFn: (b: { body: string }) => api.addNote(id!, b),
      onSuccess: () => { invalidateOne(); toast.success({ title: t("toasts.note_added") }); },
      onError: fail,
    }),
    deleteNote: useMutation({
      mutationFn: (noteId: string) => api.deleteNote(id!, noteId),
      onSuccess: () => { invalidateOne(); toast.success({ title: t("toasts.note_deleted") }); },
      onError: fail,
    }),
    addParticipant: useMutation({
      mutationFn: (b: { userId: string; role: string }) => api.addParticipant(id!, b),
      onSuccess: () => invalidateOne(),
      onError: fail,
    }),
    removeParticipant: useMutation({
      mutationFn: (participantId: string) => api.removeParticipant(id!, participantId),
      onSuccess: () => invalidateOne(),
      onError: fail,
    }),
  };
}
