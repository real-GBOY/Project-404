import type { ScanOutcome } from "@/api/types";

/**
 * The door scanner's state machine. The one rule it exists to protect: GREEN IS ONLY EVER SHOWN FOR A SERVER ANSWER.
 * A code that has been read but not answered is `checking`; no answer in time is `offline` (nothing recorded, the same code can be
 * re-sent); only a response from the check-in endpoint can produce a `verdict`.
 */
export type Screen =
  | { name: "home" }
  | { name: "scanning" }
  | { name: "checking"; request: ScanRequest }
  | { name: "verdict"; outcome: ScanOutcome; request: ScanRequest }
  | { name: "offline"; request: ScanRequest }
  | { name: "manual" }
  | { name: "camera_blocked" }
  | { name: "camera_missing" };

export interface ScanRequest {
  /** The QR payload, or the typed ticket ID. Exactly one is set. */
  token?: string;
  ticketId?: string;
}

export type Action =
  | { type: "start" }
  | { type: "home" }
  | { type: "manual" }
  | { type: "code_read"; request: ScanRequest }
  | { type: "answered"; outcome: ScanOutcome }
  | { type: "no_answer" }
  | { type: "retry" }
  | { type: "camera_blocked" }
  | { type: "camera_missing" };

export function reduce(s: Screen, a: Action): Screen {
  switch (a.type) {
    case "start":
      return { name: "scanning" };
    case "home":
      return { name: "home" };
    case "manual":
      return { name: "manual" };
    case "camera_blocked":
      return { name: "camera_blocked" };
    case "camera_missing":
      return { name: "camera_missing" };
    case "code_read":
      // Only a scanner that is looking (or a typed ID) may start a check; a stray read while a verdict is up is ignored.
      return s.name === "scanning" || s.name === "manual" ? { name: "checking", request: a.request } : s;
    case "answered":
      return s.name === "checking" ? { name: "verdict", outcome: a.outcome, request: s.request } : s;
    case "no_answer":
      return s.name === "checking" ? { name: "offline", request: s.request } : s;
    case "retry":
      return s.name === "offline" ? { name: "checking", request: s.request } : s;
  }
}

/** The same code read twice within this window on one device is one read (the server still decides). */
export const DEDUPE_MS = 3000;
/** No answer within this long is "no connection": nothing was recorded. */
export const ANSWER_TIMEOUT_MS = 5000;

export function isDuplicateRead(last: { code: string; at: number } | null, code: string, now: number): boolean {
  return !!last && last.code === code && now - last.at < DEDUPE_MS;
}

export type VerdictKind = "approved" | "used" | "unknown" | "revoked" | "other_event" | "closed";

export function verdictKind(o: ScanOutcome): VerdictKind {
  if (o.result === "ADMITTED") return "approved";
  if (o.result === "ALREADY_USED") return "used";
  switch (o.reason) {
    case "revoked":
      return "revoked";
    case "other_event":
      return "other_event";
    case "event_closed":
      return "closed";
    default:
      return "unknown";
  }
}

/** Ticket IDs are typed in capitals without confusable characters; accept lower case and stray spaces/dashes. */
export function normalizeTicketId(raw: string): string {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = v.startsWith("TKT") ? v.slice(3) : v;
  return body.length === 8 ? `TKT-${body.slice(0, 4)}-${body.slice(4)}` : raw.trim().toUpperCase();
}
export const isCompleteTicketId = (v: string) => /^TKT-[A-HJ-NP-Z0-9]{4}-[A-HJ-NP-Z0-9]{4}$/.test(normalizeTicketId(v));
