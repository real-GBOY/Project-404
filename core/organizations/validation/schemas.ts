import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, digits and dashes.")
    .optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateSettingsSchema = z.object({
  settings: z.record(z.unknown()),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  membershipRole: z.string().trim().min(1).max(40).optional(),
});
