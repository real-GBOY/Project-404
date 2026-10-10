import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/, "Use lowercase letters, numbers and dashes (3-80 characters).");
const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

export const venueSchema = z
  .object({
    name: trimmed(120).min(2),
    area: trimmed(120).default(""),
    address: trimmed(240).default(""),
    mapUrl: z.string().trim().url().max(500).nullable().default(null),
    capacity: z.number().int().min(1).max(500_000),
  })
  .strict();
export const venuePatchSchema = venueSchema.partial().strict();

const policies = z
  .object({ refund: trimmed(1000).optional(), age: trimmed(1000).optional(), entry: trimmed(1000).optional() })
  .strict()
  .transform((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>);
const programItem = z.object({ time: trimmed(40).min(1), title: trimmed(120).min(1), detail: trimmed(300).optional() }).strict();

const eventBase = z.object({
  slug,
  title: trimmed(140).min(2),
  category: trimmed(60).default(""),
  description: trimmed(5000).default(""),
  venueId: z.string().min(1).max(64),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  coverUrl: z.string().trim().url().max(500).nullable().default(null),
  maxPerBooking: z.number().int().min(1).max(6).default(6),
  namedTickets: z.boolean().default(false),
  holdHours: z.number().int().min(1).max(168).default(24),
  allowResubmission: z.boolean().default(true),
  supportEmail: z.string().trim().email().max(200).nullable().default(null),
  policies: policies.default({}),
  program: z.array(programItem).max(40).default([]),
});

export const createEventSchema = eventBase.strict().refine((e) => e.endsAt > e.startsAt, { path: ["endsAt"], message: "End must be after start." });
export const updateEventSchema = eventBase.partial().strict();

export const ticketTypeSchema = z
  .object({
    name: trimmed(80).min(2),
    description: trimmed(300).default(""),
    priceMinor: z.number().int().min(0).max(100_000_000),
    quantity: z.number().int().min(0).max(500_000),
    maxPerBooking: z.number().int().min(1).max(6).default(6),
    onSale: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .strict();
export const ticketTypePatchSchema = ticketTypeSchema.partial().strict();

export const paymentMethodSchema = z
  .object({
    type: z.enum(["instapay", "wallet", "bank", "cash_deposit", "other"]),
    label: trimmed(80).min(2),
    recipientName: trimmed(120).min(2),
    identifier: trimmed(200).min(2),
    instructions: z.array(trimmed(300).min(1)).max(10).default([]),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .strict();
export const paymentMethodPatchSchema = paymentMethodSchema.partial().strict();

export type VenueBody = z.infer<typeof venueSchema>;
export type VenuePatchBody = z.infer<typeof venuePatchSchema>;
export type CreateEventBody = z.infer<typeof createEventSchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
export type TicketTypeBody = z.infer<typeof ticketTypeSchema>;
export type TicketTypePatchBody = z.infer<typeof ticketTypePatchSchema>;
export type PaymentMethodBody = z.infer<typeof paymentMethodSchema>;
export type PaymentMethodPatchBody = z.infer<typeof paymentMethodPatchSchema>;
