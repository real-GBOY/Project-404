import { z } from "zod";
import { isoDate } from "@hotel/hotel/pricing/validation/pricing.schema.js";

export const checkInSchema = z.object({ roomId: z.string().min(1).nullish() }).strict();

export const checkOutSchema = z
  .object({
    payment: z
      .object({
        method: z.enum(["cash", "card", "bank_transfer", "online"]),
        amount: z
          .number()
          .positive()
          .max(10_000_000)
          .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most two decimals"),
      })
      .strict()
      .nullish(),
  })
  .strict();

export const extendSchema = z.object({ departure: isoDate }).strict();

export type CheckInBody = z.infer<typeof checkInSchema>;
export type CheckOutBody = z.infer<typeof checkOutSchema>;
export type ExtendBody = z.infer<typeof extendSchema>;
