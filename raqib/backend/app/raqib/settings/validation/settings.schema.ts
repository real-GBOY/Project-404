import { z } from "zod";

const flag = z.boolean();
const pair = z.tuple([z.union([z.literal(0), z.literal(1)]), z.union([z.literal(0), z.literal(1)])]);
const roleList = z
  .string()
  .max(60)
  .regex(/^(qm|qe|pm|ins|gs|guard|gm)(,(qm|qe|pm|ins|gs|guard|gm))*$|^$/);

export const orgSettingsSchema = z
  .object({
    org: z
      .object({
        nameAr: z.string().trim().min(1).max(120),
        nameEn: z.string().trim().min(1).max(120),
        cr: z.string().trim().max(40),
        cityAr: z.string().trim().max(60),
        cityEn: z.string().trim().max(60),
        lang: z.enum(["ar", "en"]),
        tz: z.string().trim().min(1).max(60),
      })
      .strict(),
    scoring: z.object({ high: z.number().int().min(1).max(100), mid: z.number().int().min(0).max(99), naExcluded: flag, criticalFail: flag }).strict(),
    insp: z
      .object({
        latestOnStart: flag,
        publishNeedsApproval: flag,
        ncNote: flag,
        ncEvidence: flag,
        lockAfterSubmit: flag,
        overdueHours: z.number().int().min(0).max(720),
      })
      .strict(),
    attach: z
      .object({
        photo: z.number().int().min(1).max(100),
        video: z.number().int().min(1).max(2000),
        doc: z.number().int().min(1).max(200),
        types: z.string().trim().max(120),
        videoProtected: flag,
        linkMinutes: z.number().int().min(1).max(120),
        retention: z.number().int().min(1).max(30),
        compress: flag,
      })
      .strict(),
    notif: z.record(z.string().max(30), pair),
    report: z.object({ lang: z.enum(["both", "ar", "en"]), branding: flag, evidence: flag, signatures: flag, history: flag, watermark: flag }).strict(),
    security: z
      .object({
        session: z.number().int().min(5).max(480),
        mfa: roleList,
        pwLen: z.number().int().min(8).max(64),
        pwRotate: z.number().int().min(0).max(365),
        lockout: z.number().int().min(3).max(20),
      })
      .strict(),
    audit: z.object({ retention: z.number().int().min(1).max(30), exportRoles: roleList }).strict(),
  })
  .strict();

export const updateSettingsSchema = z.object({ settings: orgSettingsSchema, reason: z.string().trim().min(3).max(500) }).strict();
export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
