import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const updateSettingsSchema = z
  .object({
    hotelName: z.string().trim().min(1).max(120),
    checkInTime: time,
    checkOutTime: time,
    /** Fraction, e.g. 0.14 for Egypt's 14% VAT. */
    taxRate: z.coerce.number().min(0).max(0.5),
    address: z.string().trim().max(300).nullable(),
    phone: z.string().trim().max(40).nullable(),
    email: z.string().trim().email().max(200).nullable(),
  })
  .partial()
  .strict();

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
