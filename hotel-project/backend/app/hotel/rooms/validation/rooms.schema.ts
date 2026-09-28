import { z } from "zod";

const money = z.coerce
  .number()
  .positive()
  .max(1_000_000)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most two decimals");

const booleanFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

export const createRoomTypeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,8}$/, "2–8 letters or digits"),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullish(),
    capacity: z.coerce.number().int().min(1).max(12),
    beds: z.string().trim().min(1).max(80),
    baseRate: money,
    amenities: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

export const updateRoomTypeSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullable(),
    capacity: z.coerce.number().int().min(1).max(12),
    beds: z.string().trim().min(1).max(80),
    baseRate: money,
    amenities: z.array(z.string().trim().min(1).max(40)).max(30),
    sortOrder: z.coerce.number().int().min(0).max(1000),
  })
  .partial()
  .strict();

export const listRoomTypesQuery = z.object({ includeArchived: booleanFlag });

export const createRoomSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{1,10}$/, "Up to 10 letters, digits or dashes"),
    floor: z.coerce.number().int().min(-5).max(200),
    roomTypeId: z.string().min(1),
    notes: z.string().trim().max(500).nullish(),
  })
  .strict();

export const updateRoomSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{1,10}$/, "Up to 10 letters, digits or dashes"),
    floor: z.coerce.number().int().min(-5).max(200),
    roomTypeId: z.string().min(1),
    notes: z.string().trim().max(500).nullable(),
  })
  .partial()
  .strict();

export const listRoomsQuery = z.object({
  roomTypeId: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  housekeepingStatus: z.enum(["clean", "dirty", "cleaning", "inspected"]).optional(),
  serviceStatus: z.enum(["in_service", "maintenance", "out_of_service"]).optional(),
  includeArchived: booleanFlag,
});

export type CreateRoomTypeBody = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeBody = z.infer<typeof updateRoomTypeSchema>;
export type ListRoomTypesQuery = z.infer<typeof listRoomTypesQuery>;
export type CreateRoomBody = z.infer<typeof createRoomSchema>;
export type UpdateRoomBody = z.infer<typeof updateRoomSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsQuery>;
