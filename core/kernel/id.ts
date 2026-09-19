import { customAlphabet } from "nanoid";

/**
 * Prefixed identifiers: `usr_V1StGXR8Z5jdHi6BMyT`. The prefix makes IDs
 * self-describing in logs, URLs, and error messages, and makes a
 * copy-pasted-into-the-wrong-field mistake obvious.
 *
 * `createPrefixedId` is the ONE implementation of the format (`<prefix>_<21
 * url-safe chars>`). Core has no opinion on which prefixes exist: a product
 * that needs its own set declares its own union and wraps this.
 */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generate = customAlphabet(alphabet, 21);

/** `createPrefixedId("mat")` → `"mat_V1StGXR8Z5jdHi6BMyT4c"`. */
export function createPrefixedId<P extends string>(prefix: P): string {
  return `${prefix}_${generate()}`;
}

/** True when `id` was minted with `prefix` (requires the underscore, so `org` never matches `organisation_…`). */
export function hasIdPrefix<P extends string>(id: string, prefix: P): boolean {
  return id.startsWith(`${prefix}_`);
}

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
  | "dlq"
  | "conv" // AI Copilot conversation (core/assistant)
  | "amsg" // AI Copilot message
  | "mcv" // messaging conversation (core/messaging)
  | "mmsg" // messaging message
  | "matt"; // messaging attachment

/** Core's own IDs. Products use their own typed wrapper over `createPrefixedId`. */
export function newId(prefix: IdPrefix): string {
  return createPrefixedId(prefix);
}

export function hasPrefix(id: string, prefix: IdPrefix): boolean {
  return hasIdPrefix(id, prefix);
}
