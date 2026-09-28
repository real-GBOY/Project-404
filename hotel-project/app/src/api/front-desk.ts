import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";
import type { PaymentMethod, PaymentStatus } from "./billing";
import type { Reservation } from "./reservations";
import { roomKeys } from "./rooms";

export interface DeskReservation extends Reservation {
  folio: { total: number; paid: number; balance: number; paymentStatus: PaymentStatus };
  room: { housekeepingStatus: string; serviceStatus: string; ready: boolean } | null;
}

export interface DeskDay {
  date: string;
  arrivals: DeskReservation[];
  departures: DeskReservation[];
  inHouse: DeskReservation[];
}

export function useDeskDay(enabled = true) {
  return useQuery({
    queryKey: ["front-desk", "today"],
    queryFn: () => http<DeskDay>(ENDPOINTS.frontDesk.today),
    enabled,
    refetchInterval: 60_000,
  });
}

function useInvalidateDesk() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      ["front-desk"],
      ["finance"],
      ["folio-summaries"],
      ["reservations"],
      ["folio"],
      ["calendar"],
      roomKeys.rooms,
      ["housekeeping"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useCheckIn() {
  const invalidate = useInvalidateDesk();
  return useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId?: string | null }) =>
      http<Reservation>(ENDPOINTS.frontDesk.checkIn(id), {
        method: "POST",
        body: { roomId: roomId ?? null },
      }),
    onSuccess: invalidate,
  });
}

export function useCheckOut() {
  const invalidate = useInvalidateDesk();
  return useMutation({
    mutationFn: ({
      id,
      payment,
      refund,
      idempotencyKey,
    }: {
      id: string;
      payment: { method: PaymentMethod; amount: number } | null;
      /** Return any overpayment (e.g. unused nights on an early departure) as part of check-out. */
      refund: boolean;
      idempotencyKey: string;
    }) =>
      http<{
        reservation: Reservation;
        invoiceId: string;
        housekeepingTaskId: string;
        refunded: boolean;
      }>(ENDPOINTS.frontDesk.checkOut(id), {
        method: "POST",
        body: { payment, ...(refund && { refund: true }) },
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function useExtendStay() {
  const invalidate = useInvalidateDesk();
  return useMutation({
    mutationFn: ({ id, departure }: { id: string; departure: string }) =>
      http<Reservation>(ENDPOINTS.frontDesk.extend(id), { method: "POST", body: { departure } }),
    onSuccess: invalidate,
  });
}
