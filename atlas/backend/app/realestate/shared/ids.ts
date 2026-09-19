import { createPrefixedId, hasIdPrefix } from "@core/kernel/id.js";

/**
 * Prefixed identifiers for real-estate domain rows, mirroring Core's `newId`
 * convention: the format is Core's `createPrefixedId` (`core/kernel/id.ts`);
 * this file owns only the real-estate prefix set.
 *
 *   realestateId("prj") -> "prj_V1StGXR8Z5jdHi6BMyT4c"
 */
export type RealestateIdPrefix =
  | "prj" // project
  | "bld" // building
  | "unt" // unit
  | "prc" // price list
  | "led" // lead
  | "cus" // customer
  | "cun" // customer <-> unit ownership link
  | "act" // activity
  | "fup" // followup
  | "rsv" // reservation
  | "ctr" // contract
  | "pln" // payment plan
  | "ins" // installment
  | "com" // commission
  | "pay" // payment
  | "frp" // financial report
  | "tsk" // task
  | "wfl" // workflow
  | "wfs" // workflow step
  | "apr" // approval
  | "doc" // document
  | "aig"; // AI insight

export const realestateId = (prefix: RealestateIdPrefix): string => createPrefixedId(prefix);

export const hasRealestatePrefix = (id: string, prefix: RealestateIdPrefix): boolean =>
  hasIdPrefix(id, prefix);
