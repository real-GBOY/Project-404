import { httpClient } from "@/lib/api/http-client";
import type {
  Client,
  ClientActivityRow,
  ClientContact,
  ClientDocumentRow,
  ClientInvoiceRow,
  ClientList,
  ClientListParams,
  ClientMatterRow,
} from "../types/client";
import type { ClientFormOutput, ContactFormValues } from "../schemas/client.schema";

export function listClients(params: ClientListParams, signal?: AbortSignal): Promise<ClientList> {
  return httpClient<ClientList>("/clients", {
    query: {
      q: params.q,
      status: params.status,
      type: params.type,
      sort: params.sort,
      page: params.page,
    },
    signal,
  });
}

export function getClient(id: string, signal?: AbortSignal): Promise<Client> {
  return httpClient<Client>(`/clients/${id}`, { signal });
}

export function createClient(body: ClientFormOutput): Promise<Client> {
  return httpClient<Client>("/clients", { method: "POST", body });
}

export function updateClient(id: string, body: Partial<ClientFormOutput>): Promise<Client> {
  return httpClient<Client>(`/clients/${id}`, { method: "PATCH", body });
}

export function archiveClient(id: string): Promise<Client> {
  return httpClient<Client>(`/clients/${id}/archive`, { method: "POST" });
}

export function getClientContacts(id: string, signal?: AbortSignal): Promise<ClientContact[]> {
  return httpClient<ClientContact[]>(`/clients/${id}/contacts`, { signal });
}

export function addClientContact(id: string, body: ContactFormValues): Promise<ClientContact> {
  return httpClient<ClientContact>(`/clients/${id}/contacts`, { method: "POST", body });
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
