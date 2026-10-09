import { createPrefixedId, hasIdPrefix } from "@core/kernel/id.js";

/**
 * Prefixed identifiers for Admit domain rows, mirroring Core's `newId` convention: the format is
 * Core's `createPrefixedId` (`core/kernel/id.ts`); this file owns only the Admit prefix set.
 *
 *   admitId("evt") -> "evt_V1StGXR8Z5jdHi6BMyT4c"
 */
export type AdmitIdPrefix =
  | "vnu" // venue
  | "evt" // event
  | "tkt" // ticket type
  | "pmt" // payment method
  | "bkg" // booking
  | "bkl" // booking line
  | "sub" // payment submission
  | "scn" // scan attempt
  | "tln" // booking timeline entry
  | "eml"; // email message

export const admitId = (prefix: AdmitIdPrefix): string => createPrefixedId(prefix);

export const hasAdmitPrefix = (id: string, prefix: AdmitIdPrefix): boolean => hasIdPrefix(id, prefix);
