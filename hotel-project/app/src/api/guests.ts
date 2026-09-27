import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";

export type IdDocumentType = "national_id" | "passport";

export interface Guest {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  preferences: string | null;
  vip: boolean;
  createdAt: string;
}

export interface GuestProfile extends Guest {
  notes: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
}

export interface GuestInput {
  fullName: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  preferences: string | null;
  vip: boolean;
}

export const guestKeys = {
  list: (params: object) => ["guests", "list", params] as const,
  detail: (id: string) => ["guests", "detail", id] as const,
  all: ["guests"] as const,
};

export function useGuests(params: { q?: string; page: number; pageSize: number }) {
  return useQuery({
    queryKey: guestKeys.list(params),
    queryFn: () =>
      http<{ items: Guest[]; total: number }>(ENDPOINTS.guests.list, {
        query: { q: params.q || undefined, page: params.page, pageSize: params.pageSize },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: guestKeys.detail(id),
    queryFn: () => http<GuestProfile>(ENDPOINTS.guests.byId(id)),
  });
}

export function useSaveGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: GuestInput }) =>
      id
        ? http<Guest>(ENDPOINTS.guests.byId(id), { method: "PATCH", body: input })
        : http<Guest>(ENDPOINTS.guests.list, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.all }),
  });
}

export function useAddGuestNote(guestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      http<{ id: string }>(ENDPOINTS.guests.notes(guestId), { method: "POST", body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.detail(guestId) }),
  });
}
