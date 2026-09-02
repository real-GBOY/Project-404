import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast-context";
import { useTranslation } from "react-i18next";
import {
  addClientContact,
  archiveClient,
  createClient,
  getClient,
  getClientActivity,
  getClientBilling,
  getClientContacts,
  getClientDocuments,
  getClientMatters,
  listClients,
  updateClient,
} from "../api/clients.api";
import { clientKeys } from "../api/clients.keys";
import type { ClientListParams } from "../types/client";
import type { ClientFormOutput, ContactFormValues } from "../schemas/client.schema";

export function useClientList(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: ({ signal }) => listClients(params, signal),
    placeholderData: (prev) => prev,
  });
}

export function useClient(id: string) {
  return useQuery({ queryKey: clientKeys.detail(id), queryFn: ({ signal }) => getClient(id, signal) });
}

export function useClientMatters(id: string) {
  return useQuery({ queryKey: clientKeys.tab(id, "matters"), queryFn: ({ signal }) => getClientMatters(id, signal) });
}
export function useClientDocuments(id: string) {
  return useQuery({ queryKey: clientKeys.tab(id, "documents"), queryFn: ({ signal }) => getClientDocuments(id, signal) });
}
export function useClientBilling(id: string) {
  return useQuery({ queryKey: clientKeys.tab(id, "billing"), queryFn: ({ signal }) => getClientBilling(id, signal) });
}
export function useClientActivity(id: string) {
  return useQuery({ queryKey: clientKeys.tab(id, "activity"), queryFn: ({ signal }) => getClientActivity(id, signal) });
}
export function useClientContacts(id: string) {
  return useQuery({ queryKey: clientKeys.tab(id, "contacts"), queryFn: ({ signal }) => getClientContacts(id, signal) });
}

export function useClientMutations(id?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("clients");
  const invalidate = () => qc.invalidateQueries({ queryKey: clientKeys.all });

  const create = useMutation({
    mutationFn: (body: ClientFormOutput) => createClient(body),
    onSuccess: (client) => {
      invalidate();
      toast.success({ title: t("toasts.created", { name: client.name }) });
    },
    onError: () => toast.error({ title: t("toasts.save_failed") }),
  });

  const update = useMutation({
    mutationFn: (body: Partial<ClientFormOutput>) => updateClient(id!, body),
    onSuccess: () => {
      invalidate();
      toast.success({ title: t("toasts.updated") });
    },
    onError: () => toast.error({ title: t("toasts.save_failed") }),
  });

  const archive = useMutation({
    mutationFn: () => archiveClient(id!),
    onSuccess: () => {
      invalidate();
      toast.success({ title: t("toasts.archived") });
    },
    onError: () => toast.error({ title: t("toasts.save_failed") }),
  });

  const addContact = useMutation({
    mutationFn: (body: ContactFormValues) => addClientContact(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.detail(id!) });
      toast.success({ title: t("toasts.contact_added") });
    },
    onError: () => toast.error({ title: t("toasts.save_failed") }),
  });

  return { create, update, archive, addContact };
}
