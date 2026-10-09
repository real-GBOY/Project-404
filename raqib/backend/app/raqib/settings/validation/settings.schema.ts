import { z } from "zod";

const flag = z.boolean();
const pair = z.tuple([z.union([z.literal(0), z.literal(1)]), z.union([z.literal(0), z.literal(1)])]);
const roleList = z
  .string()
  .max(60)
  .regex(/^(qm|qe|pm|ins|gs|guard|gm|adm)(,(qm|qe|pm|ins|gs|guard|gm|adm))*$|^$/);

const escalationRole = z.enum(["responsible", "qm", "qe", "pm", "ins", "gs", "gm", "adm"]);

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
        logo: z.string().max(80),
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
        allowEarlyStart: flag,
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
    ranking: z
      .object({
        weights: z
          .object({
            observations: z.number().int().min(0).max(10),
            improvement: z.number().int().min(0).max(10),
            complaints: z.number().int().min(0).max(10),
            contract: z.number().int().min(0).max(10),
          })
          .strict(),
      })
      .strict(),
    training: z.object({ guardReviewBySupervisor: flag }).strict(),
    escalation: z
      .object({
        enabled: flag,
        countFrom: z.enum(["assigned", "due"]),
        weekend: z.array(z.number().int().min(0).max(6)).max(6),
        levels: z
          .array(z.object({ days: z.number().int().min(1).max(365), roles: z.array(escalationRole).min(1).max(8) }).strict())
          .min(1)
          .max(5),
        highSeverity: z.object({ immediate: flag, roles: z.array(escalationRole).max(8) }).strict(),
      })
      .strict()
      .refine((e) => new Set(e.levels.map((l) => l.days)).size === e.levels.length, { message: "Each level needs its own number of days." }),
    schedule: z
      .object({
        shifts: z
          .array(
            z
              .object({
                key: z.string().regex(/^[a-z][a-z0-9_]{1,24}$/),
                nameAr: z.string().trim().min(1).max(40),
                nameEn: z.string().trim().min(1).max(40),
                start: z.string().regex(/^(([01][0-9]|2[0-3]):[0-5][0-9])?$/),
                end: z.string().regex(/^(([01][0-9]|2[0-3]):[0-5][0-9])?$/),
              })
              .strict()
              .refine((s) => (s.start === "") === (s.end === ""), { message: "Give both the start and the end of a shift, or neither." }),
          )
          .min(1)
          .max(12),
        minRestHours: z.number().int().min(0).max(48),
        maxConsecutiveDays: z.number().int().min(0).max(31),
      })
      .strict()
      .refine((s) => new Set(s.shifts.map((x) => x.key)).size === s.shifts.length, { message: "Shift keys must be unique." }),
  })
  .strict();

export const updateSettingsSchema = z.object({ settings: orgSettingsSchema, reason: z.string().trim().min(3).max(500) }).strict();
export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>;
