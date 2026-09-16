import { z } from "zod";

export const listCustomersQuery = z.object({
  status: z.enum(["active", "pending"]).optional(),
  primaryProjectId: z.string().optional(),
  agentId: z.string().optional(),
  /** Free-text search across name/email/phone/id, ranked by relevance. */
  q: z.string().trim().min(1).max(200).optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().nullish(),
  phone: z.string().trim().max(60).nullish(),
  primaryProjectId: z.string().nullish(),
  agentId: z.string().min(1),
  nationalId: z.string().trim().max(60).nullish(),
  address: z.string().trim().max(400).nullish(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  email: z.string().trim().email().nullish(),
  phone: z.string().trim().max(60).nullish(),
  agentId: z.string().optional(),
  status: z.enum(["active", "pending"]).optional(),
});

export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
export type CreateCustomerBody = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerSchema>;
