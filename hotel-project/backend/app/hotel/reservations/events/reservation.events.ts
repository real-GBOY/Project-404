import { defineEvent } from "@core/contracts/index.js";

/**
 * Reservation domain events (`<module>.<pastTenseAction>`, versioned payloads). Published on the
 * use case's own transaction; external subscribers (notifications, reminders) receive them via
 * Core's outbox, so a slow side effect never holds the booking transaction open.
 */
export interface ReservationEventPayload extends Record<string, unknown> {
  reservationId: string;
  code: string;
  guestId: string;
  arrival: string;
  departure: string;
  actorId: string | null;
}

export const reservationCreated = (
  p: ReservationEventPayload & { status: string; source: string },
) => defineEvent("reservation.created", 1, p);

export const reservationConfirmed = (p: ReservationEventPayload) =>
  defineEvent("reservation.confirmed", 1, p);

export const reservationCancelled = (p: ReservationEventPayload & { reason: string | null }) =>
  defineEvent("reservation.cancelled", 1, p);

export const reservationNoShow = (p: ReservationEventPayload) =>
  defineEvent("reservation.no_show", 1, p);

export const reservationChanged = (
  p: ReservationEventPayload & { change: "room" | "dates"; roomId: string },
) => defineEvent("reservation.changed", 1, p);

export const reservationCheckedIn = (p: ReservationEventPayload & { roomId: string | null }) =>
  defineEvent("reservation.checked_in", 1, p);

export const reservationCheckedOut = (
  p: ReservationEventPayload & { roomId: string | null; invoiceId: string | null },
) => defineEvent("reservation.checked_out", 1, p);
