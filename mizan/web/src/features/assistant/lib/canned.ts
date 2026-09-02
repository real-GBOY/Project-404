/**
 * Canned "Ask Mizan" responses (decision #13 — stub only, no LLM, no tables).
 * Every response is static text; any "action" a response offers resolves to a
 * clearly-marked demo message, never a fake success.
 */

export interface CannedTurn {
  answer: string;
  /** optional follow-up chips */
  followUps?: string[];
  /** an action the assistant can "take" — always resolves to a demo notice */
  action?: { label: string };
}

const RESPONSES: { match: RegExp; turn: CannedTurn }[] = [
  {
    match: /hearing|جلس/i,
    turn: {
      answer:
        "You have 4 hearings in the next two weeks. The nearest is the merits hearing for Al-Nour Trading v. Delta Bank at the Cairo Economic Court in two days. Karim Fahmy is leading it.",
      followUps: ["Draft a prep checklist", "Who else is on that matter?"],
      action: { label: "Add a prep task to the matter" },
    },
  },
  {
    match: /task|overdue|مهام|متأخر/i,
    turn: {
      answer:
        "Two of your tasks are overdue: “Collect title deeds from client — New Cairo plot” (2 days) and “File trademark opposition grounds” (1 day). Three more are due this week.",
      followUps: ["Reassign the overdue tasks", "Show this week's tasks"],
    },
  },
  {
    match: /outstanding|invoice|owe|فاتورة|مستحق/i,
    turn: {
      answer:
        "Outstanding across all clients is EGP 4,360,000 and AED 24,000, spread over 3 sent invoices. INV-2026-0128 for Al-Nour Trading is the largest and is 15 days past due.",
      followUps: ["Send a reminder for INV-2026-0128", "Break it down by client"],
      action: { label: "Send a payment reminder" },
    },
  },
  {
    match: /.*/,
    turn: {
      answer:
        "I'm a preview of the Mizan assistant. I can summarise your hearings, tasks and billing from the demo data, but I can't take real actions or read live matters yet.",
      followUps: [
        "What hearings are coming up this week?",
        "Which of my tasks are overdue?",
        "How much is outstanding across all clients?",
      ],
    },
  },
];

export function respondTo(prompt: string): CannedTurn {
  return (RESPONSES.find((r) => r.match.test(prompt)) ?? RESPONSES[RESPONSES.length - 1]).turn;
}
