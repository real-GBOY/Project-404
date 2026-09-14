import { z } from "zod";

const STAGES = ["new", "qualified", "contacted", "viewing", "negotiation", "reserved", "contracted", "sold", "lost"] as const;
const STATUSES = ["new", "qualified", "contacted", "viewing", "negotiation", "lost"] as const;

export const listLeadsQuery = z.object({
  status: z.enum(STATUSES).optional(),
  stage: z.enum(STAGES).optional(),
  agentId: z.string().optional(),
  dealsOnly: z.coerce.boolean().optional(),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(3).max(60),
  email: z.string().trim().email().nullish(),
  source: z.enum(["referral", "website", "facebook", "broker", "exhibition", "instagram"]),
  agentId: z.string().min(1),
  interestText: z.string().trim().max(400).nullish(),
  valueEgp: z.coerce.number().int().min(0).optional(),
});

export const updateLeadSchema = z.object({
  status: z.enum(STATUSES).optional(),
  stage: z.enum(STAGES).optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  valueEgp: z.coerce.number().int().min(0).optional(),
  agentId: z.string().optional(),
});

/** Sets probability/expected-close, which is what promotes a lead onto the Deals screen. */
export const trackAsDealSchema = z.object({
  probabilityPct: z.coerce.number().min(0).max(100),
  expectedCloseDate: z.string().date(),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuery>;
export type CreateLeadBody = z.infer<typeof createLeadSchema>;
export type UpdateLeadBody = z.infer<typeof updateLeadSchema>;
export type TrackAsDealBody = z.infer<typeof trackAsDealSchema>;
