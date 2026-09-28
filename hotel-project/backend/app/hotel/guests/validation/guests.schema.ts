import { z } from "zod";

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number with digits, spaces or dashes");

const guestFields = {
  fullName: z.string().trim().min(2).max(120),
  phone: phone.nullable(),
  email: z.string().trim().toLowerCase().email().max(200).nullable(),
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Two-letter country code, e.g. EG")
    .nullable(),
  idDocumentType: z.enum(["national_id", "passport"]).nullable(),
  idDocumentNumber: z.string().trim().min(3).max(40).nullable(),
  preferences: z.string().trim().max(1000).nullable(),
  vip: z.boolean(),
};

function contactAndDocument<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (g: { phone?: string | null; email?: string | null }) =>
        g.phone === undefined || g.email === undefined || Boolean(g.phone || g.email),
      { message: "A guest needs a phone number or an email", path: ["phone"] },
    )
    .refine(
      (g: { idDocumentType?: string | null; idDocumentNumber?: string | null }) =>
        g.idDocumentType === undefined ||
        g.idDocumentNumber === undefined ||
        Boolean(g.idDocumentType) === Boolean(g.idDocumentNumber),
      { message: "Document type and number go together", path: ["idDocumentNumber"] },
    );
}

export const createGuestSchema = contactAndDocument(
  z
    .object({
      fullName: guestFields.fullName,
      phone: guestFields.phone.default(null),
      email: guestFields.email.default(null),
      nationality: guestFields.nationality.default(null),
      idDocumentType: guestFields.idDocumentType.default(null),
      idDocumentNumber: guestFields.idDocumentNumber.default(null),
      preferences: guestFields.preferences.default(null),
      vip: guestFields.vip.default(false),
    })
    .strict(),
);

export const updateGuestSchema = contactAndDocument(z.object(guestFields).partial().strict());

export const listGuestsQuery = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  vip: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const addNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

export type CreateGuestBody = z.infer<typeof createGuestSchema>;
export type UpdateGuestBody = z.infer<typeof updateGuestSchema>;
export type ListGuestsQuery = z.infer<typeof listGuestsQuery>;
export type AddNoteBody = z.infer<typeof addNoteSchema>;
