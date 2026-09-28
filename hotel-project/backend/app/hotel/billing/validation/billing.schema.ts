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

export const refundSchema = z
  .object({
    amount: money,
    reason: z.string().trim().min(3).max(300),
    paymentId: z.string().min(1).nullish(),
  })
  .strict();

export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const invoicesQuery = z.object({
  status: z.enum(["issued", "void"]).optional(),
  q: z.string().trim().max(100).optional(),
});

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const ledgerQuery = z.object({
  kind: z.enum(["payment", "refund"]).optional(),
  method: z.enum(["cash", "card", "bank_transfer", "online"]).optional(),
  status: z.enum(["pending", "completed", "failed"]).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  q: z.string().trim().max(100).optional(),
});

export const folioSummariesQuery = z.object({
  ids: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(z.string().min(1)).max(200)),
});

export type RefundBody = z.infer<typeof refundSchema>;
export type VoidInvoiceBody = z.infer<typeof voidInvoiceSchema>;
export type InvoicesQuery = z.infer<typeof invoicesQuery>;
export type LedgerQuery = z.infer<typeof ledgerQuery>;
export type FolioSummariesQuery = z.infer<typeof folioSummariesQuery>;
export type PostChargeBody = z.infer<typeof postChargeSchema>;
export type VoidChargeBody = z.infer<typeof voidChargeSchema>;
export type CollectPaymentBody = z.infer<typeof collectPaymentSchema>;
