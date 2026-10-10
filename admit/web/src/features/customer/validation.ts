/**
 * Customer form rules - the Product Spec's validation table, in one pure module (the server enforces the same rules again).
 * Validate on blur and on submit, never on each keystroke; messages say what to do, not what went wrong.
 */

export const NAME_MSG = "Enter your full name as it should appear on the ticket.";
export const EMAIL_MSG = "Enter an email like name@example.com.";
export const PHONE_MSG = "Enter all 11 digits, e.g. 010 1234 5678.";

/** Egypt mobile: 01[0125] + 8 digits after stripping spaces/dashes and a +20 / 0020 prefix. */
export function normalizePhone(raw: string): string {
  let v = raw.replace(/[\s\-().]/g, "");
  if (v.startsWith("+20")) v = `0${v.slice(3)}`;
  else if (v.startsWith("0020")) v = `0${v.slice(4)}`;
  return v;
}

export const validName = (v: string) => /^[\p{L}\p{M}][\p{L}\p{M} '-]{1,79}$/u.test(v.trim());
export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) && v.trim().length <= 200;
export const validPhone = (v: string) => /^01[0125]\d{8}$/.test(normalizePhone(v));

export interface DetailsInput {
  name: string;
  email: string;
  phone: string;
  /** One entry per ticket, in order. */
  holders: string[];
  namedTickets: boolean;
  hasPolicies: boolean;
  policyAck: boolean;
}

/** field id -> message. Ids are the form's anchors (`name`, `email`, `phone`, `holder-0`, `policy`). */
export function validateDetails(i: DetailsInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!validName(i.name)) errors.name = NAME_MSG;
  if (!validEmail(i.email)) errors.email = EMAIL_MSG;
  if (!validPhone(i.phone)) errors.phone = PHONE_MSG;
  if (i.namedTickets) {
    i.holders.forEach((h, n) => {
      if (!validName(h)) errors[`holder-${n}`] = `Add a name for ticket ${n + 1}.`;
    });
  }
  if (i.hasPolicies && !i.policyAck) errors.policy = "Please confirm you have read the event policies.";
  return errors;
}

/** Single-field check used on blur. */
export function validateField(id: string, i: DetailsInput): string | undefined {
  return validateDetails(i)[id];
}

export const PROOF_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"];
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

/** Proof file rules: jpg/png/heic/pdf, one file, up to 10 MB. */
export function validateProof(file: { type: string; size: number; name: string }): string | null {
  if (!PROOF_TYPES.includes(file.type) && !/\.(jpe?g|png|heic|heif|pdf)$/i.test(file.name)) return "Upload a photo (JPG, PNG, HEIC) or a PDF.";
  if (file.size > PROOF_MAX_BYTES) return `This file is ${Math.ceil(file.size / 1_048_576)} MB. Upload one under 10 MB.`;
  if (file.size === 0) return "This file is empty. Choose another.";
  return null;
}

export const validTxn = (v: string) => v.trim() === "" || (v.trim().length >= 4 && v.trim().length <= 40);
