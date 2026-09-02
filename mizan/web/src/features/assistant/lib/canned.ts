/**
 * Canned "Ask Mizan" responses (decision #13 — stub only, no LLM, no tables,
 * no backend call). Copy is deliberately generic: the assistant is a labelled
 * preview and must not state specific matters, invoices or amounts as if they
 * were read from the real data.
 */

export interface CannedTurn {
  answer: string;
  /** optional follow-up chips */
  followUps?: string[];
  /** an action the assistant can "take" — always resolves to a demo notice */
  action?: { label: string };
}

const PREVIEW_NOTICE =
  "I'm a preview of the Mizan assistant. A future version will summarise your hearings, tasks and billing from live data and take actions for you — for now I can only point you to the right screen.";

const RESPONSES: { match: RegExp; turn: CannedTurn }[] = [
  {
    match: /hearing|جلس/i,
    turn: {
      answer: `${PREVIEW_NOTICE} Your upcoming hearings are on the Hearings screen and the Calendar, grouped by date and lead lawyer.`,
      followUps: ["Open the Hearings screen", "Show this week on the Calendar"],
      action: { label: "Add a prep task to a matter" },
    },
  },
  {
    match: /task|overdue|مهام|متأخر/i,
    turn: {
      answer: `${PREVIEW_NOTICE} The Tasks screen has an "Overdue" and a "Due this week" view, and each matter lists its own open tasks.`,
      followUps: ["Open my overdue tasks", "Show this week's tasks"],
    },
  },
  {
    match: /outstanding|invoice|owe|فاتورة|مستحق|billing|payment/i,
    turn: {
      answer: `${PREVIEW_NOTICE} Finance shows billed, collected and outstanding per currency, and each client's profile has its own billing tab.`,
      followUps: ["Open Finance", "Break it down by client"],
    },
  },
  {
    match: /.*/,
    turn: {
      answer: PREVIEW_NOTICE,
      followUps: [
        "What hearings are coming up?",
        "Which of my tasks are overdue?",
        "How much is outstanding across all clients?",
      ],
    },
  },
];

export function respondTo(prompt: string): CannedTurn {
  return (RESPONSES.find((r) => r.match.test(prompt)) ?? RESPONSES[RESPONSES.length - 1]).turn;
}
