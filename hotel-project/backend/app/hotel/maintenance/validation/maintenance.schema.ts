import { z } from "zod";
import { isoDate } from "@hotel/hotel/pricing/validation/pricing.schema.js";
import { TICKET_STATUSES } from "../domain/ticket-state.js";

export const listTicketsQuery = z.object({
  status: z.enum(TICKET_STATUSES as [string, ...string[]]).optional(),
  open: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  mine: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  roomId: z.string().optional(),
});

export const reportSchema = z
  .object({
    roomId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).nullable().default(null),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    roomImpact: z.enum(["none", "maintenance", "out_of_service"]).default("none"),
    expectedBack: isoDate.nullable().default(null),
  })
  .strict();

export const assignSchema = z.object({ assigneeId: z.string().min(1) }).strict();
export const notesSchema = z
  .object({ notes: z.string().trim().max(2000).nullable().default(null) })
  .strict();
export const reopenSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
export const costSchema = z
  .object({
    cost: z
      .number()
      .min(0)
      .max(10_000_000)
      .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most two decimals"),
  })
  .strict();
export const extendSchema = z.object({ expectedBack: isoDate }).strict();

export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;
export type ReportBody = z.infer<typeof reportSchema>;
