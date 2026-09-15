import { moduleLogger } from "@core/kernel/logging/logger.js";

const log = moduleLogger("assistant-response");

/**
 * A last-ditch scrub of the model's free-text answer for credential-shaped
 * strings before it reaches the user.
 *
 * This is **defence-in-depth, not a security boundary**. The real guarantees are
 * upstream: the LLM only ever sees org-scoped, permission-checked data (no keys
 * are in any prompt or tool result), so in practice there is nothing secret for
 * it to echo. This exists to catch a future mistake — a secret accidentally
 * placed in context, or a novel exfiltration path — not to make an unsafe design
 * safe.
 */
const SECRET_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "openai_key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { label: "groq_key", re: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { label: "aws_key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    label: "bearer_jwt",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  { label: "pg_url", re: /\bpostgres(?:ql)?:\/\/[^\s"']+/g },
  { label: "private_key_block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

export interface GuardedResponse {
  text: string;
  redacted: string[];
}

export function guardResponse(answer: string, correlationId: string): GuardedResponse {
  let text = answer;
  const redacted: string[] = [];
  for (const { label, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      redacted.push(label);
      text = text.replace(re, "[redacted]");
    }
    re.lastIndex = 0;
  }
  if (redacted.length > 0) {
    log.warn({ correlationId, redacted }, "assistant response scrubbed — credential-shaped output");
  }
  return { text, redacted };
}
