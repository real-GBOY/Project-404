import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { publicApi } from "@/api";

export const qk = {
  catalogue: (org: string) => ["public", org, "events"] as const,
  event: (org: string, event: string) => ["public", org, "event", event] as const,
  booking: (org: string, ref: string) => ["public", org, "booking", ref] as const,
  tickets: (org: string, ref: string) => ["public", org, "tickets", ref] as const,
};

export function useOrg(): string {
  return useParams().org ?? "";
}

export function useCatalogue() {
  const org = useOrg();
  return useQuery({
    queryKey: qk.catalogue(org),
    queryFn: () => publicApi.catalogue(org),
    staleTime: 15_000,
  });
}

export function usePublicEvent() {
  const org = useOrg();
  const event = useParams().event ?? "";
  return useQuery({
    queryKey: qk.event(org, event),
    queryFn: () => publicApi.event(org, event),
    staleTime: 10_000,
  });
}

/** A booking page is addressed by the ref in the path and the magic-link secret `k` in the query. */
export function useBookingAccess(): { org: string; ref: string; k: string } {
  const { org = "", ref = "" } = useParams();
  const [params] = useSearchParams();
  return { org, ref, k: params.get("k") ?? "" };
}

/** The booking, kept fresh: the status page polls every 30 s while the answer can still change (anything the server decides asynchronously). */
export function useGuestBooking(poll = false) {
  const { org, ref, k } = useBookingAccess();
  return useQuery({
    queryKey: qk.booking(org, ref),
    queryFn: () => publicApi.booking(org, ref, k),
    enabled: !!k,
    retry: false,
    refetchInterval: (q) =>
      poll &&
      q.state.data &&
      (q.state.data.status === "IN_REVIEW" ||
        q.state.data.status === "AWAITING_PAYMENT" ||
        (q.state.data.status === "CONFIRMED" &&
          q.state.data.emailStatus !== "ACCEPTED" &&
          q.state.data.emailStatus !== "DELIVERED"))
        ? 30_000
        : false,
  });
}

export function useGuestTickets() {
  const { org, ref, k } = useBookingAccess();
  return useQuery({
    queryKey: qk.tickets(org, ref),
    queryFn: () => publicApi.tickets(org, ref, k),
    enabled: !!k,
    retry: false,
  });
}

/** Pages a booking link opens at: `/b/:org/:ref/...?k=`. Keep `k` when moving between them. */
export function bookingPath(
  org: string,
  ref: string,
  k: string,
  page: "" | "pay" | "upload" | "submitted" = "",
): string {
  return `/b/${org}/${ref}${page ? `/${page}` : ""}?k=${encodeURIComponent(k)}`;
}
export const ticketsPath = (org: string, ref: string, k: string) =>
  `/t/${org}/${ref}?k=${encodeURIComponent(k)}`;
