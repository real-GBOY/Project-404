import { httpClient } from "@/lib/api/http-client";
import type {
  Client,
  ClientActivityRow,
  ClientDocumentRow,
  ClientInvoiceRow,
  ClientList,
  ClientListParams,
  ClientMatterRow,
} from "./types";

export const clientKeys = {
  all: ["clients"] as const,
  list: (p: ClientListParams) => [...clientKeys.all, "list", p] as const,
  detail: (id: string) => [...clientKeys.all, "detail", id] as const,
  tab: (id: string, tab: string) => [...clientKeys.all, "detail", id, tab] as const,
};

export function listClients(params: ClientListParams, signal?: AbortSignal): Promise<ClientList> {
  return httpClient<ClientList>("/clients", {
    query: { q: params.q, status: params.status, type: params.type, sort: params.sort, page: params.page },
    signal,
  });
}

export function getClient(id: string, signal?: AbortSignal): Promise<Client> {
  return httpClient<Client>(`/clients/${id}`, { signal });
}

export function getClientMatters(id: string, signal?: AbortSignal): Promise<ClientMatterRow[]> {
  return httpClient<ClientMatterRow[]>(`/clients/${id}/matters`, { signal });
}

export function getClientDocuments(id: string, signal?: AbortSignal): Promise<ClientDocumentRow[]> {
  return httpClient<ClientDocumentRow[]>(`/clients/${id}/documents`, { signal });
}

export function getClientBilling(id: string, signal?: AbortSignal): Promise<ClientInvoiceRow[]> {
  return httpClient<ClientInvoiceRow[]>(`/clients/${id}/billing`, { signal });
}

export function getClientActivity(id: string, signal?: AbortSignal): Promise<ClientActivityRow[]> {
  return httpClient<ClientActivityRow[]>(`/clients/${id}/activity`, { signal });
}
