import { z } from "zod";

const nullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const listClientsQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["all", "active", "archived"]).default("all"),
  type: z.enum(["all", "company", "individual"]).default("all"),
  sort: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(["company", "individual"]),
  email: nullableString(320),
  phone: nullableString(60),
  taxId: nullableString(120),
  address: nullableString(400),
  notes: nullableString(2000),
});

export const updateClientSchema = createClientSchema.partial();

export const createContactSchema = z.object({
  name: z.string().trim().min(2).max(200),
  role: nullableString(120),
  email: nullableString(320),
  phone: nullableString(60),
  primary: z.boolean().optional(),
});

export type ListClientsQuery = z.infer<typeof listClientsQuery>;
export type CreateClientBody = z.infer<typeof createClientSchema>;
export type UpdateClientBody = z.infer<typeof updateClientSchema>;
export type CreateContactBody = z.infer<typeof createContactSchema>;
