import { z } from "zod";

/** Egypt mobile: 01[0125] + 8 digits, after stripping spaces/dashes and a +20 / 0020 prefix. */
export function normalizeEgyptMobile(raw: string): string {
  let v = raw.replace(/[\s\-().]/g, "");
  if (v.startsWith("+20")) v = `0${v.slice(3)}`;
  else if (v.startsWith("0020")) v = `0${v.slice(4)}`;
  return v;
}

export const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name as it should appear on the ticket.")
  .max(80, "Enter your full name as it should appear on the ticket.")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} '-]*$/u, "Enter your full name as it should appear on the ticket.");

export const emailField = z.string().trim().toLowerCase().email("Enter an email like name@example.com.").max(200, "Enter an email like name@example.com.");

export const mobileField = z
  .string()
  .transform(normalizeEgyptMobile)
  .refine((v) => /^01[0125]\d{8}$/.test(v), "Enter all 11 digits, e.g. 010 1234 5678.");

const item = z
  .object({
    ticketTypeId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(6),
    holderNames: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
  })
  .strict();

export const createBookingSchema = z
  .object({
    items: z.array(item).min(1).max(10),
    customer: z.object({ name: fullName, email: emailField, phone: mobileField }).strict(),
    policyAck: z.boolean().default(false),
  })
  .strict();
export type CreateBookingBody = z.infer<typeof createBookingSchema>;

export const resendLinkSchema = z.object({ ref: z.string().trim().min(6).max(20), email: emailField }).strict();
export type ResendLinkBody = z.infer<typeof resendLinkSchema>;

export const listBookingsQuery = z.object({
  eventId: z.string().max(64).optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim().toUpperCase()) : undefined))
    .pipe(z.array(z.enum(["AWAITING_PAYMENT", "IN_REVIEW", "CONFIRMED", "REJECTED", "EXPIRED", "CANCELLED"])).optional()),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuery>;

export const cancelBookingSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();
export type CancelBookingBody = z.infer<typeof cancelBookingSchema>;
