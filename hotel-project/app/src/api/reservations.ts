import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";
import { roomKeys } from "./rooms";

export type ReservationStatus =
  "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
export type ReservationCommand = "confirm" | "check_in" | "check_out" | "cancel" | "no_show";
export type ReservationSource =
  "direct" | "phone" | "walk_in" | "website" | "booking_com" | "expedia";

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  direct: "Direct",
  phone: "Phone",
  walk_in: "Walk-in",
  website: "Direct Website",
  booking_com: "Booking.com",
  expedia: "Expedia",
};

export interface NightPrice {
  date: string;
  rate: number;
  rule: string | null;
}

export interface Reservation {
  id: string;
  code: string;
  status: ReservationStatus;
  source: ReservationSource;
  guestId: string;
  guestName: string;
  guestPhone: string | null;
  guestVip: boolean;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomNumber: string | null;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  nightlyRates: NightPrice[];
  roomTotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface ReservationDetail extends Reservation {
  commands: ReservationCommand[];
  history: Array<{
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    actorName: string;
    reason: string | null;
    at: string;
  }>;
}

export interface Quote {
  nights: NightPrice[];
  roomTotal: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  minNights: number;
}

export interface AvailabilityResult {
  roomType: {
    id: string;
    code: string;
    name: string;
    capacity: number;
    beds: string;
    baseRate: number;
    amenities: string[];
  };
  availableRooms: number;
  bookable: boolean;
  unavailableReason: string | null;
  quote: Quote | null;
}

export interface CalendarBar {
  kind: "reservation" | "block";
  start: string;
  end: string;
  reservationId: string | null;
  code: string | null;
  status: ReservationStatus | null;
  guestName: string | null;
  reason: string | null;
}

export interface CalendarData {
  from: string;
  to: string;
  days: string[];
  rooms: Array<{
    id: string;
    number: string;
    floor: number;
    roomTypeId: string;
    roomTypeName: string;
    roomTypeCode: string;
    bars: CalendarBar[];
  }>;
}

export interface CreateReservationInput {
  guestId: string;
  roomTypeId: string;
  roomId?: string | null;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  source: ReservationSource;
  notes?: string | null;
  discountCode?: string | null;
  confirm: boolean;
}

export interface ReservationListParams {
  status?: ReservationStatus;
  q?: string;
  guestId?: string;
  arrivalOn?: string;
  departureOn?: string;
  page: number;
  pageSize: number;
}

export const reservationKeys = {
  all: ["reservations"] as const,
  list: (p: object) => ["reservations", "list", p] as const,
  detail: (id: string) => ["reservations", "detail", id] as const,
  availability: (p: object) => ["availability", p] as const,
  freeRooms: (p: object) => ["availability", "rooms", p] as const,
  calendar: (p: object) => ["calendar", p] as const,
};

export function useReservations(params: ReservationListParams, enabled = true) {
  return useQuery({
    queryKey: reservationKeys.list(params),
    queryFn: () =>
      http<{ items: Reservation[]; total: number }>(ENDPOINTS.reservations.list, {
        query: { ...params, q: params.q || undefined },
      }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => http<ReservationDetail>(ENDPOINTS.reservations.byId(id)),
  });
}

export function useAvailability(
  params: {
    arrival: string;
    departure: string;
    adults: number;
    children: number;
    discountCode?: string;
  },
  enabled: boolean,
) {
  return useQuery({
    queryKey: reservationKeys.availability(params),
    queryFn: () =>
      http<{ nights: number; results: AvailabilityResult[] }>(ENDPOINTS.availability.search, {
        query: { ...params, discountCode: params.discountCode || undefined },
      }),
    enabled,
  });
}

export function useFreeRooms(
  params: { roomTypeId: string; arrival: string; departure: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: reservationKeys.freeRooms(params),
    queryFn: async () =>
      (
        await http<{ items: Array<{ id: string; number: string }> }>(ENDPOINTS.availability.rooms, {
          query: params,
        })
      ).items,
    enabled,
  });
}

export function useCalendar(params: { from?: string; days: number }) {
  return useQuery({
    queryKey: reservationKeys.calendar(params),
    queryFn: () => http<CalendarData>(ENDPOINTS.calendar, { query: params }),
    placeholderData: keepPreviousData,
  });
}

/** Everything a reservation change can affect on screen. */
function useInvalidateBookings() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: reservationKeys.all });
    void qc.invalidateQueries({ queryKey: ["availability"] });
    void qc.invalidateQueries({ queryKey: ["calendar"] });
    void qc.invalidateQueries({ queryKey: roomKeys.rooms });
  };
}

export function useCreateReservation() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: CreateReservationInput) =>
      http<Reservation>(ENDPOINTS.reservations.list, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

type Action =
  | { kind: "confirm" }
  | { kind: "cancel"; reason: string | null }
  | { kind: "no_show" }
  | { kind: "change_room"; roomId: string }
  | { kind: "change_dates"; arrival: string; departure: string };

export function useReservationAction(id: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (action: Action) => {
      const e = ENDPOINTS.reservations;
      switch (action.kind) {
        case "confirm":
          return http<Reservation>(e.confirm(id), { method: "POST" });
        case "cancel":
          return http<Reservation>(e.cancel(id), {
            method: "POST",
            body: { reason: action.reason },
          });
        case "no_show":
          return http<Reservation>(e.noShow(id), { method: "POST" });
        case "change_room":
          return http<Reservation>(e.changeRoom(id), {
            method: "POST",
            body: { roomId: action.roomId },
          });
        case "change_dates":
          return http<Reservation>(e.changeDates(id), {
            method: "POST",
            body: { arrival: action.arrival, departure: action.departure },
          });
      }
    },
    onSuccess: invalidate,
  });
}
