import { createPrefixedId, hasIdPrefix } from "@core/kernel/id.js";

/**
 * Prefixed identifiers for law-firm domain rows. The format itself is Core's
 * (`createPrefixedId`); this file owns only the law-firm prefix set, so the
 * product doesn't reach into Core's `IdPrefix` union.
 *
 *   lawfirmId("mat") -> "mat_V1StGXR8Z5jdHi6BMyT4c"
 */
export type LawfirmIdPrefix =
  | "cli" // client
  | "cnt" // client contact
  | "mat" // matter
  | "mpt" // matter participant
  | "mup" // matter update (timeline entry)
  | "muf" // matter update file link
  | "mnt" // matter note
  | "hrg" // hearing
  | "tsk" // task
  | "tme" // time entry
  | "cdoc" // case document
  | "inv" // invoice
  | "ifl" // invoice fee line
  | "idb" // invoice disbursement
  | "pay" // payment
  | "exp" // expense
  | "stf" // staff profile
  | "cal" // calendar event
  | "act" // activity entry
  | "rmd"; // reminder

export const lawfirmId = (prefix: LawfirmIdPrefix): string => createPrefixedId(prefix);

export const hasLawfirmPrefix = (id: string, prefix: LawfirmIdPrefix): boolean => hasIdPrefix(id, prefix);
