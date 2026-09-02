import { z } from "zod";

const currency = z.enum(["EGP", "AED", "USD", "SAR"]);

export const updateSettingsSchema = z
  .object({
    firmName: z.string().trim().max(200),
    registrationNumber: z.string().trim().max(120),
    address: z.string().trim().max(400),
    defaultCurrency: currency,
    vatRate: z.number().min(0).max(1),
    matterTypes: z.array(z.string().trim().min(1).max(80)).max(50),
    courts: z.array(z.string().trim().min(1).max(120)).max(100),
    standardRates: z
      .array(
        z.object({
          role: z.string().trim().min(1).max(80),
          hourlyRate: z.number().min(0),
          currency: currency,
        }),
      )
      .max(50),
    aiAssistantEnabled: z.boolean(),
  })
  .partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
