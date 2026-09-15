import { z } from "zod";

export const listReservationsQuery = z.object({
  status: z.enum(["active", "expiring", "expired", "converted"]).optional(),
  agentId: z.string().optional(),
  projectId: z.string().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const createReservationSchema = z.object({
  unitId: z.string().min(1),
  customerId: z.string().min(1),
  agentId: z.string().min(1),
  holdDays: z.coerce.number().int().min(1).max(90).default(14),
  depositEgp: z.coerce.number().int().positive(),
});

export type ListReservationsQuery = z.infer<typeof listReservationsQuery>;
export type CreateReservationBody = z.infer<typeof createReservationSchema>;
