import { customAlphabet } from "nanoid";

/**
 * Prefixed identifiers: `usr_V1StGXR8Z5jdHi6BMyT`. The prefix makes IDs
 * self-describing in logs, URLs, and error messages, and makes a
 * copy-pasted-into-the-wrong-field mistake obvious.
 */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, 21);

export type IdPrefix =
  | "usr"
  | "org"
  | "mem"
  | "role"
  | "perm"
  | "file"
  | "aud"
  | "ntf"
  | "tmpl"
  | "rt" // refresh token
  | "vt" // verification token
  | "evt"
  | "obx"
  | "dlq";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${generate()}`;
}

export function hasPrefix(id: string, prefix: IdPrefix): boolean {
  return id.startsWith(`${prefix}_`);
}
