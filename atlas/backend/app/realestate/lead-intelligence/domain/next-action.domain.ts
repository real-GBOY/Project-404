/**
 * Deterministic "Recommended Next Action" — plain business rules over the
 * lead's own state and the (already-computed, already-deterministic) match
 * results. The AI layer may later rephrase/translate this text for the
 * sales brief, but it never invents the action itself (see
 * `application/lead-intelligence-service.ts`).
 */
import type { UnitMatchResult } from "./lead-matching.domain.js";

export interface NextActionInput {
  leadStatus: "new" | "qualified" | "contacted" | "viewing" | "negotiation" | "lost";
  requirementsExtracted: boolean;
  hasBudget: boolean;
  matches: UnitMatchResult[];
}

export interface NextAction {
  action: string;
  reason: string;
}

const STRONG_MATCH_THRESHOLD = 85;
const USABLE_MATCH_THRESHOLD = 60;

export function recommendNextAction(input: NextActionInput): NextAction {
  if (input.leadStatus === "lost") {
    return { action: "No action needed", reason: "This lead is marked lost." };
  }
  if (!input.requirementsExtracted) {
    return {
      action: "Capture the client's requirements",
      reason: "No AI requirement analysis has been run for this lead yet.",
    };
  }
  if (!input.hasBudget) {
    return {
      action: "Ask for a budget range",
      reason: "A budget wasn't captured in the requirements — matching can't rank by price fit without it.",
    };
  }
  if (input.matches.length === 0) {
    return {
      action: "Present alternative projects or timelines",
      reason: "No available units currently satisfy these requirements.",
    };
  }

  const top = input.matches[0];
  if (top.score >= STRONG_MATCH_THRESHOLD) {
    return {
      action: "Schedule a site visit within 24 hours",
      reason: `A strong match (${top.score}% — ${top.code}) is available now.`,
    };
  }
  if (top.score >= USABLE_MATCH_THRESHOLD) {
    return {
      action: "Send property details for the top matches and follow up",
      reason: `The best available match (${top.score}% — ${top.code}) is a reasonable, not perfect, fit.`,
    };
  }
  return {
    action: "Present alternative units — current inventory is a weak fit",
    reason: `The best available match is only ${top.score}% (${top.code}); consider widening the requirements.`,
  };
}
