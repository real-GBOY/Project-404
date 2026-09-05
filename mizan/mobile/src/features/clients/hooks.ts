import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
import { clientKeys } from "./api";
import type { ClientListParams } from "./types";

export const useClientList = (p: ClientListParams) =>
  useQuery({
    queryKey: clientKeys.list(p),
    queryFn: ({ signal }) => api.listClients(p, signal),
    placeholderData: (prev) => prev,
  });

export const useClient = (id: string) =>
  useQuery({ queryKey: clientKeys.detail(id), queryFn: ({ signal }) => api.getClient(id, signal), enabled: !!id });

export const useClientMatters = (id: string) =>
  useQuery({ queryKey: clientKeys.tab(id, "matters"), queryFn: ({ signal }) => api.getClientMatters(id, signal), enabled: !!id });

export const useClientActivity = (id: string) =>
  useQuery({ queryKey: clientKeys.tab(id, "activity"), queryFn: ({ signal }) => api.getClientActivity(id, signal), enabled: !!id });
