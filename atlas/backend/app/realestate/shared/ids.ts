import { customAlphabet } from "nanoid";

/**
 * Prefixed identifiers for real-estate domain rows, mirroring Core's `newId`
 * convention (`core/kernel/id.ts`) and Mizan's `lawfirm/shared/ids.ts` — same
 * alphabet and length, a separate prefix set of its own.
 *
 *   realestateId("prj") -> "prj_V1StGXR8Z5jdHi6BMyT4c"
 */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, 21);

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
  | "conv" // AI conversation
  | "amsg" // AI message
  | "aig"; // AI insight

export function realestateId(prefix: RealestateIdPrefix): string {
  return `${prefix}_${generate()}`;
}

export function hasRealestatePrefix(id: string, prefix: RealestateIdPrefix): boolean {
  return id.startsWith(`${prefix}_`);
}
