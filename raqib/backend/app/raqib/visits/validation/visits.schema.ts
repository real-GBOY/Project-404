import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM");
const reason = z.string().trim().min(3).max(500);
const id = z.string().min(1).max(60);

export const createVisitSchema = z
  .object({
    projectId: id,
    siteId: id,
    areaId: id.nullish(),
    areaText: z.string().trim().max(120).nullish(),
    inspectorId: id.nullish(),
    type: z.enum(["routine", "surprise", "follow", "night"]).default("routine"),
    shift: z.enum(["morning", "evening", "night"]).default("morning"),
    date: isoDate,
    time,
    guardIds: z.array(id).max(50).default([]),
    reason,
  })
  .strict();

export const rescheduleVisitSchema = z
  .object({ date: isoDate, time, inspectorId: id.nullish().transform((v) => (v === undefined ? undefined : v)), reason })
  .strict();
export const cancelVisitSchema = z.object({ reason }).strict();
export const listVisitsQuery = z
  .object({
    projectId: id.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.string().max(4).optional(),
    cursor: z.string().max(60).optional(),
  })
  .strict();

export type CreateVisitBody = z.infer<typeof createVisitSchema>;
export type RescheduleVisitBody = z.infer<typeof rescheduleVisitSchema>;
export type CancelVisitBody = z.infer<typeof cancelVisitSchema>;
export type ListVisitsQuery = z.infer<typeof listVisitsQuery>;
