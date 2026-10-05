import { z } from "zod";
import { MODULES, ROLE_KEYS } from "@raqib/raqib/shared/modules.js";

export const applyTemplatesSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            role: z.enum(ROLE_KEYS),
            module: z.enum(MODULES),
            actions: z.string().regex(/^[VAESRPDX]*$/),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export type ApplyTemplatesBody = z.infer<typeof applyTemplatesSchema>;
