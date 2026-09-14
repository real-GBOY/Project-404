/**
 * Server-side port of the frontend's keyword-matched canned answers
 * (`atlas/web/src/mocks/fixtures/copilot-transcripts.ts`'s `ask(q)`). No LLM —
 * matches Mizan Copilot's original "stub only" decision; upgradeable later.
 */
export interface ChatStat {
  label: string;
  value: string;
  delta: string;
}
export interface ChatRow {
  name: string;
  value: string;
  meta: string;
}
export interface CannedAnswer {
  text: string;
  stats?: ChatStat[];
  rows: ChatRow[];
  cites: string[];
  follow: string[];
}

export type CannedTopic = "velocity" | "outstanding" | "underperforming" | "likely" | "summar";

/** 'velocit'->velocity, 'outstand'|'revenue'->outstanding, 'agent'|'underperf'->underperforming,
 *  'likely'|'unit'->likely, 'summar'|'histor'->summar, else velocity. */
export function matchCannedTopic(question: string): CannedTopic {
  const q = question.toLowerCase();
  if (q.includes("velocit")) return "velocity";
  if (q.includes("outstand") || q.includes("revenue")) return "outstanding";
  if (q.includes("agent") || q.includes("underperf")) return "underperforming";
  if (q.includes("likely") || q.includes("unit")) return "likely";
  if (q.includes("summar") || q.includes("histor")) return "summar";
  return "velocity";
}

export const CANNED_SUGGESTIONS: string[] = [
  "Which projects have the highest sales velocity?",
  "Show me the units most likely to sell soon.",
  "Which high-value leads haven't been contacted recently?",
  "How much revenue is currently outstanding?",
  "Summarise a customer's history.",
];
