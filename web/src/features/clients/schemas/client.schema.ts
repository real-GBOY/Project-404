import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "clients.errors.name_required").max(200),
  type: z.enum(["company", "individual"]),
  email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "clients.errors.email_invalid")
    .transform((v) => (v === "" ? undefined : v)),
  phone: optionalString,
  taxId: optionalString,
  address: optionalString,
  notes: z.string().trim().max(2000).optional().transform((v) => (v === "" ? undefined : v)),
});
export type ClientFormValues = z.input<typeof clientSchema>;
export type ClientFormOutput = z.output<typeof clientSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "clients.errors.name_required").max(200),
  role: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "clients.errors.email_invalid")
    .transform((v) => (v === "" ? undefined : v)),
  phone: optionalString,
  primary: z.boolean().optional(),
});
export type ContactFormValues = z.input<typeof contactSchema>;
