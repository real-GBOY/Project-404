import { z } from "zod";
import { leadRequirementsSchema } from "../domain/requirements.schema.js";
import type { LeadRequirements } from "../domain/requirements.schema.js";
import type { UnitMatchResult } from "../domain/lead-matching.domain.js";
import type { NextAction } from "../domain/next-action.domain.js";

/** What the model is asked to return for extraction — identical shape to
 *  `leadRequirementsSchema`, restated as a plain object schema description
 *  in the prompt text below (the model doesn't see Zod, just the prompt). */
export const extractionResponseSchema = leadRequirementsSchema;

export function buildExtractionPrompt(notes: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You turn a real-estate sales agent's notes about a client into a structured JSON requirement profile for Atlas, an Egyptian real-estate CRM. The notes may be in English, Arabic, or a mix of both (agents often write "3 bedrooms" mixed with Arabic) — read whichever language is used, do not translate the client's words into your reply, just extract structure.

Reply with ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape (all keys required, use null/[] for anything not mentioned):
{
  "budgetMinEgp": number|null,       // lower bound of the stated budget, in EGP (e.g. "8 to 10 million" -> 8000000)
  "budgetMaxEgp": number|null,       // upper bound, in EGP
  "locations": string[],             // place names as the client said them, e.g. ["New Cairo"]
  "propertyTypes": string[],         // e.g. ["apartment"], ["penthouse"], ["duplex"], ["studio"]
  "bedroomsMin": number|null,
  "bedroomsMax": number|null,        // if only one bedroom count was given, set both min and max to it
  "preferredFloors": number[],       // e.g. "first floor" -> [1]. Ground floor -> [0].
  "deliveryWithinMonths": number|null, // convert a relative delivery timeline to months, e.g. "within two years" -> 24, "in 18 months" -> 18. null if not mentioned. Never invent a date — this is a DURATION from today, not a calendar date.
  "otherPreferences": string[],      // anything real the client mentioned that doesn't fit the fields above (view, amenities, near a school, etc.) — verbatim, don't invent any.
  "intent": "high"|"medium"|"low"|"unknown", // your read of urgency/seriousness from the tone — a soft judgment call, never used for matching, only for the sales brief header.
  "summary": string                  // one short sentence (<=200 chars) summarising the requirement, in the same language the client used.
}

Do not fabricate any number or place you don't see evidence for in the notes — leave it null/empty instead. Budgets are always in Egyptian Pounds (EGP) unless another currency is explicitly named.`;

  return { systemPrompt, userPrompt: notes };
}

export const explanationResponseSchema = z
  .object({
    explanation: z.string().trim().min(1).max(600),
    suggestedMessage: z.string().trim().min(1).max(800),
  })
  .strict();

export type ExplanationResult = z.infer<typeof explanationResponseSchema>;

/**
 * The AI's second and last job in this module: turn the ALREADY-COMPUTED,
 * already-authorized deterministic result into two pieces of human text. It
 * receives nothing beyond what's passed in here — no database access, no
 * tool, no ability to change a score or add a unit that isn't already in
 * `topMatches`.
 */
export function buildExplanationPrompt(input: {
  leadName: string;
  locale: "ar" | "en";
  requirements: LeadRequirements;
  topMatches: UnitMatchResult[];
  nextAction: NextAction;
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You write two short pieces of client-facing sales text for Atlas, an Egyptian real-estate CRM, from data a deterministic matching engine already computed. You do not choose or re-rank the matches, and you do not invent any fact not given to you below.

Reply with ONLY a single JSON object, no prose outside it:
{
  "explanation": string,       // 1-3 sentences, addressed to the SALES AGENT (not the client), explaining in plain language why the top match(es) scored the way they did, referencing only the reasons given below.
  "suggestedMessage": string   // a short, warm, professional draft message the agent could send to the client, in ${input.locale === "ar" ? "Arabic" : "English"} (mixing in a little of the other language the way Egyptian agents naturally do is fine), mentioning the top 1-2 matches by project/unit-type/price. This is a DRAFT for the agent to review and edit before sending — never claim it has been sent.
}`;

  const matchLines = input.topMatches
    .slice(0, 5)
    .map(
      (m) =>
        `- ${m.code} · ${m.projectName} · ${m.unitType} · floor ${m.floor} · ${m.areaSqm}sqm · ${m.basePriceEgp.toLocaleString()} EGP · score ${m.score}% · ${m.reasons
          .map((r) => `${r.met ? "✓" : "✗"} ${r.label}`)
          .join(", ")}`,
    )
    .join("\n");

  const userPrompt = `Client: ${input.leadName}
Requirement summary: ${input.requirements.summary || "(none given)"}
Stated budget: ${formatRange(input.requirements.budgetMinEgp, input.requirements.budgetMaxEgp)}
Stated locations: ${input.requirements.locations.join(", ") || "(none)"}
Stated bedrooms: ${formatRange(input.requirements.bedroomsMin, input.requirements.bedroomsMax)}

Top matches (already ranked, already scored — do not reorder or re-score):
${matchLines || "(no available units currently match)"}

Recommended next action (already decided — mention it naturally, don't contradict it): ${input.nextAction.action}`;

  return { systemPrompt, userPrompt };
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "(not stated)";
  if (min !== null && max !== null) return `${min}–${max}`;
  return String(min ?? max);
}

/**
 * Used when the AI explanation call fails or the assistant isn't configured
 * — the brief must still be useful without it (§17: AI enhances, never
 * gates, the deterministic result). Plain template over the same data the
 * AI would have seen, nothing more.
 */
export function buildDeterministicExplanation(topMatches: UnitMatchResult[], nextAction: NextAction): string {
  if (topMatches.length === 0) {
    return `No available units currently satisfy the stated requirements. Recommended action: ${nextAction.action.toLowerCase()}.`;
  }
  const top = topMatches[0];
  const met = top.reasons.filter((r) => r.met).map((r) => r.label.toLowerCase());
  const metText = met.length > 0 ? met.join(", ") : "a broad match on the stated preferences";
  return `${top.code} (${top.projectName}) is the top match at ${top.score}%, on ${metText}. Recommended action: ${nextAction.action.toLowerCase()}.`;
}

export function buildDeterministicMessage(leadName: string, topMatches: UnitMatchResult[], requirements: LeadRequirements): string {
  if (topMatches.length === 0) {
    return `Hi ${leadName}, thanks for sharing your requirements${requirements.summary ? ` (${requirements.summary})` : ""}. We don't have an exact match in inventory right now, but I'd like to discuss some close alternatives — when's a good time to talk?`;
  }
  const lines = topMatches
    .slice(0, 2)
    .map((m) => `${m.unitType} in ${m.projectName} (unit ${m.code}, ${m.areaSqm}sqm, ${m.basePriceEgp.toLocaleString()} EGP)`);
  return `Hi ${leadName}, based on what you shared${requirements.summary ? ` (${requirements.summary})` : ""}, I found a great fit — ${lines.join(" and ")}. Would you like to schedule a viewing?`;
}
