import { z } from "zod";
import { isIsoDate } from "@hotel/hotel/shared/dates.js";

export const isoDate = z.string().refine(isIsoDate, "Use a real date as YYYY-MM-DD");

export const createRateRuleSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    kind: z.enum(["seasonal", "weekend", "promotion"]),
    roomTypeId: z.string().min(1).nullable().default(null),
    startDate: isoDate.nullable().default(null),
    endDate: isoDate.nullable().default(null),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().default(null),
    adjustmentType: z.enum(["percent", "fixed_rate"]),
    adjustmentValue: z.number().finite(),
    minNights: z.number().int().min(1).max(30).nullable().default(null),
    priority: z.number().int().min(0).max(100).default(0),
  })
  .strict()
  .refine((r) => !r.startDate || !r.endDate || r.endDate >= r.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine(
    (r) =>
      r.adjustmentType === "fixed_rate"
        ? r.adjustmentValue > 0
        : r.adjustmentValue > -100 && r.adjustmentValue <= 500,
    {
      message: "Percent must be above -100 and at most 500; a fixed rate must be positive",
      path: ["adjustmentValue"],
    },
  );

export const createDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,20}$/, "3–20 letters, digits or dashes"),
    description: z.string().trim().max(200).nullable().default(null),
    percentOff: z.number().gt(0).max(100),
    validFrom: isoDate.nullable().default(null),
    validTo: isoDate.nullable().default(null),
  })
  .strict();

export type CreateRateRuleBody = z.infer<typeof createRateRuleSchema>;
export type CreateDiscountBody = z.infer<typeof createDiscountSchema>;
