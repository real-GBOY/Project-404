import { z } from "zod";

const money = z
  .number()
  .positive()
  .max(10_000_000)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most two decimals");

export const postChargeSchema = z
  .object({
    kind: z.enum(["breakfast", "extra_bed", "minibar", "laundry", "transfer", "service"]),
    description: z.string().trim().min(2).max(200),
    quantity: z.number().int().min(1).max(100).default(1),
    unitPrice: money,
  })
  .strict();

export const voidChargeSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const collectPaymentSchema = z
  .object({
    method: z.enum(["cash", "card", "bank_transfer", "online"]),
    amount: money,
  })
  .strict();

export type PostChargeBody = z.infer<typeof postChargeSchema>;
export type VoidChargeBody = z.infer<typeof voidChargeSchema>;
export type CollectPaymentBody = z.infer<typeof collectPaymentSchema>;
