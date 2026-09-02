import { customAlphabet } from "nanoid";

/**
 * Prefixed identifiers for law-firm domain rows, mirroring Core's `newId`
 * convention (`core/kernel/id.ts`) — same alphabet and length, a separate
 * prefix set so the product doesn't reach into Core's `IdPrefix` union.
 *
 *   lawfirmId("mat") -> "mat_V1StGXR8Z5jdHi6BMyT4c"
 */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, 21);

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

export function lawfirmId(prefix: LawfirmIdPrefix): string {
  return `${prefix}_${generate()}`;
}

export function hasLawfirmPrefix(id: string, prefix: LawfirmIdPrefix): boolean {
  return id.startsWith(`${prefix}_`);
}
