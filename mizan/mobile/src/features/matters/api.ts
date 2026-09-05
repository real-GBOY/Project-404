import { httpClient } from "@/lib/api/http-client";
import type {
  Matter,
  MatterActivityRow,
  MatterFinancials,
  MatterList,
  MatterListParams,
  MatterNote,
  MatterParticipant,
  MatterUpdate,
} from "./types";

export const matterKeys = {
  all: ["matters"] as const,
  list: (p: MatterListParams) => [...matterKeys.all, "list", p] as const,
  detail: (id: string) => [...matterKeys.all, "detail", id] as const,
  tab: (id: string, tab: string) => [...matterKeys.all, "detail", id, tab] as const,
};

export const listMatters = (p: MatterListParams, signal?: AbortSignal) =>
  httpClient<MatterList>("/matters", {
    query: { q: p.q, status: p.status, practiceArea: p.practiceArea, clientId: p.clientId, sort: p.sort, page: p.page },
    signal,
  });

export const getMatter = (id: string, signal?: AbortSignal) => httpClient<Matter>(`/matters/${id}`, { signal });

export const closeMatter = (id: string) => httpClient<Matter>(`/matters/${id}/close`, { method: "POST" });

export const getParticipants = (id: string, signal?: AbortSignal) =>
  httpClient<MatterParticipant[]>(`/matters/${id}/participants`, { signal });

export const getUpdates = (id: string, signal?: AbortSignal) =>
  httpClient<MatterUpdate[]>(`/matters/${id}/updates`, { signal });

export const addUpdate = (id: string, body: { body: string; documentIds?: string[] }) =>
  httpClient<MatterUpdate>(`/matters/${id}/updates`, { method: "POST", body });

export const getNotes = (id: string, signal?: AbortSignal) => httpClient<MatterNote[]>(`/matters/${id}/notes`, { signal });

export const addNote = (id: string, body: { body: string }) =>
  httpClient<MatterNote>(`/matters/${id}/notes`, { method: "POST", body });

export const getMatterFinancials = (id: string, signal?: AbortSignal) =>
  httpClient<MatterFinancials>(`/matters/${id}/financials`, { signal });

export const getMatterActivity = (id: string, signal?: AbortSignal) =>
  httpClient<MatterActivityRow[]>(`/matters/${id}/activity`, { signal });
