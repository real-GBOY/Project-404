import { z } from "zod";
import { isoDate } from "@hotel/hotel/pricing/validation/pricing.schema.js";
import { RESERVATION_STATUSES } from "../domain/reservation-state.js";

const SOURCES = ["direct", "phone", "walk_in", "website", "booking_com", "expedia"] as const;

const stay = {
  arrival: isoDate,
  departure: isoDate,
};

/** Note there is deliberately no price field: the server quotes every stay itself. */
export const createReservationSchema = z
  .object({
    guestId: z.string().min(1),
    roomTypeId: z.string().min(1),
    roomId: z.string().min(1).nullish(),
    ...stay,
    adults: z.number().int().min(1).max(12),
    children: z.number().int().min(0).max(12).default(0),
    source: z.enum(SOURCES),
    notes: z.string().trim().max(1000).nullish(),
    discountCode: z.string().trim().toUpperCase().max(20).nullish(),
    confirm: z.boolean().default(false),
  })
  .strict()
  .refine((b) => b.departure > b.arrival, {
    message: "Departure must be after arrival",
    path: ["departure"],
  });

export const listReservationsQuery = z.object({
  status: z.enum(RESERVATION_STATUSES as [string, ...string[]]).optional(),
  arrivalOn: isoDate.optional(),
  departureOn: isoDate.optional(),
  guestId: z.string().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const cancelSchema = z.object({ reason: z.string().trim().max(500).nullish() }).strict();

export const changeRoomSchema = z.object({ roomId: z.string().min(1) }).strict();

export const changeDatesSchema = z
  .object(stay)
  .strict()
  .refine((b) => b.departure > b.arrival, {
    message: "Departure must be after arrival",
    path: ["departure"],
  });

export const availabilityQuery = z
  .object({
    ...stay,
    adults: z.coerce.number().int().min(1).max(12).default(2),
    children: z.coerce.number().int().min(0).max(12).default(0),
    discountCode: z.string().trim().toUpperCase().max(20).optional(),
  })
  .refine((b) => b.departure > b.arrival, {
    message: "Departure must be after arrival",
    path: ["departure"],
  });

export const freeRoomsQuery = z.object({ roomTypeId: z.string().min(1), ...stay });

export const calendarQuery = z.object({
  from: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(31).default(7),
});

export type CreateReservationBody = z.infer<typeof createReservationSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuery>;
export type CancelBody = z.infer<typeof cancelSchema>;
export type ChangeRoomBody = z.infer<typeof changeRoomSchema>;
export type ChangeDatesBody = z.infer<typeof changeDatesSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuery>;
export type FreeRoomsQuery = z.infer<typeof freeRoomsQuery>;
export type CalendarQuery = z.infer<typeof calendarQuery>;
